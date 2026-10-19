import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { Prisma } from '@db/client';
import { TRANSACTION_RELATIONS } from '@finance/data/datasource/FinanceTransactionDatasource';
import {
  applyLedgerDeltas,
  assertInvoiceNotPaid,
  assertInvoicesNotPaid,
  lockCards,
  toLedgerEntry,
} from '@finance/data/datasource/ledger';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  ApplyRecurrenceChangeDatasourceParams,
  CreateOccurrenceDatasourceParams,
  CreateRecurrenceDatasourceParams,
  FinancialRecurrenceWithRelations,
  FindRecurrencesDatasourceFilter,
  FutureOccurrenceNumberRow,
  IFinanceRecurrenceDatasource,
  MaterializeRecurrenceDatasourceParams,
  OccurrenceRowDatasourceParams,
  RemoveRecurrenceDatasourceParams,
  RemoveRecurrenceDatasourceResult,
} from '@finance/data/repository/datasource/IFinanceRecurrenceDatasource';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { LedgerDelta, ledgerDeltas } from '@finance/domain/service/LedgerBalance';
import { Database } from '@shared/infra/db/Database';

// Account, category and card summaries come back in the same query (no N+1).
export const RECURRENCE_RELATIONS = {
  account: { select: { icon: true, id: true, name: true } },
  category: {
    select: {
      exclude_from_totals: true,
      icon: true,
      icon_color: true,
      id: true,
      name: true,
      system_key: true,
    },
  },
  credit_card: { select: { color: true, id: true, last_digits: true, title: true } },
};

interface LockableRow {
  credit_card_id: null | string;
  id: string;
  invoice_month: null | string;
  paid: boolean | null;
}

const LOCKABLE_SELECT = { credit_card_id: true, id: true, invoice_month: true, paid: true };

interface SeriesTemplate {
  account_id: null | string;
  category_id: string;
  credit_card_id: null | string;
  description: string;
  owner: Prisma.FinancialTransactionCreateManyInput['owner'];
  owner_id: string;
  type: Prisma.FinancialTransactionCreateManyInput['type'];
  value: number;
}

@Injectable()
export class FinanceRecurrenceDatasource implements IFinanceRecurrenceDatasource {
  constructor(private readonly db: Database) {}

  // Spec 034 FR 20-25 in ONE transaction. Only rows that are not locked (paid account rows, card rows in an
  // invoice with a payment record) take value / source changes; the others keep them and still take text.
  async apply(params: ApplyRecurrenceChangeDatasourceParams): Promise<string> {
    return this.db.client.$transaction(async (tx) => {
      const source = await tx.financialRecurrence.findUnique({ where: { id: params.source_id } });

      if (!source) {
        throw new NotFoundException();
      }

      const cardIds = [
        source.credit_card_id,
        params.series_patch.credit_card_id,
        params.row_patch.credit_card_id,
        params.new_series?.credit_card_id,
      ].filter((id): id is string => typeof id === 'string');

      await lockCards(tx, cardIds);
      await lockSeries(tx, source.id);

      const payments = await tx.financialInvoicePayment.findMany({
        select: { credit_card_id: true, invoice_month: true },
        where: { credit_card_id: { in: cardIds } },
      });
      const paidKeys = new Set(payments.map((p) => `${p.credit_card_id}|${p.invoice_month}`));
      function isLocked(row: LockableRow): boolean {
        return row.credit_card_id
          ? paidKeys.has(`${row.credit_card_id}|${row.invoice_month}`)
          : row.paid === true;
      }

      if (params.delete_after) {
        const late = await tx.financialTransaction.findMany({
          select: LOCKABLE_SELECT,
          where: { date: { gt: params.delete_after }, recurrence_id: source.id },
        });

        if (late.some(isLocked)) {
          throw new UnprocessableEntityException('Occurrences after the new end date are paid');
        }

        await tx.financialTransaction.deleteMany({
          where: { id: { in: late.map((row) => row.id) } },
        });
      }

      const affected = await tx.financialTransaction.findMany({
        select: LOCKABLE_SELECT,
        where: { occurrence_number: { gte: params.from_number }, recurrence_id: source.id },
      });
      const affectedIds = affected.map((row) => row.id);
      let targetId = source.id;

      if (params.new_series) {
        const created = await tx.financialRecurrence.create({
          data: params.new_series,
          select: { id: true },
        });

        targetId = created.id;
      }

      if (params.replace_rows) {
        if (affected.some(isLocked)) {
          throw new UnprocessableEntityException('An occurrence is paid');
        }

        await tx.financialTransaction.deleteMany({ where: { id: { in: affectedIds } } });
        await tx.financialTransaction.createMany({
          data: toRows(params.replace_rows, templateOf(source, params), targetId),
        });
      } else {
        await this.patchRows(tx, params, affected, targetId, isLocked);
      }

      await tx.financialRecurrence.update({
        data: params.series_patch,
        where: { id: source.id },
      });

      return targetId;
    });
  }

  private async patchRows(
    tx: Prisma.TransactionClient,
    params: ApplyRecurrenceChangeDatasourceParams,
    affected: LockableRow[],
    targetId: string,
    isLocked: (row: LockableRow) => boolean,
  ): Promise<void> {
    const { row_patch: patch } = params;
    const editable = affected.filter((row) => !isLocked(row)).map((row) => row.id);

    if (affected.length === 0) {
      return;
    }
    if (targetId !== params.source_id) {
      await tx.financialTransaction.updateMany({
        data: { recurrence_id: targetId },
        where: { id: { in: affected.map((row) => row.id) } },
      });
    }
    if (patch.description !== undefined || patch.category_id !== undefined) {
      await tx.financialTransaction.updateMany({
        data: { category_id: patch.category_id, description: patch.description },
        where: { id: { in: affected.map((row) => row.id) } },
      });
    }
    if (
      patch.value !== undefined ||
      patch.account_id !== undefined ||
      patch.credit_card_id !== undefined
    ) {
      await tx.financialTransaction.updateMany({
        data: {
          account_id: patch.account_id,
          credit_card_id: patch.credit_card_id,
          value: patch.value,
        },
        where: { id: { in: editable } },
      });
    }
    for (const item of patch.invoice_months ?? []) {
      if (editable.includes(item.id)) {
        await tx.financialTransaction.update({
          data: { invoice_month: item.invoice_month },
          where: { id: item.id },
        });
      }
    }
  }

  // Spec 034 FR 29-31. Card rows in an invoice with a payment record and rows that were refunded can't go away:
  // scope ALL keeps them as plain purchases, THIS_AND_NEXT refuses. Paid account rows need `confirm_paid`.
  async removeFrom(
    params: RemoveRecurrenceDatasourceParams,
  ): Promise<RemoveRecurrenceDatasourceResult> {
    return this.db.client.$transaction(async (tx) => {
      const series = await tx.financialRecurrence.findUnique({ where: { id: params.id } });

      if (!series) {
        throw new NotFoundException();
      }

      await lockCards(tx, series.credit_card_id ? [series.credit_card_id] : []);
      await lockSeries(tx, series.id);

      const rows = await tx.financialTransaction.findMany({
        select: {
          account_id: true,
          credit_card_id: true,
          id: true,
          invoice_month: true,
          paid: true,
          type: true,
          value: true,
        },
        where: { occurrence_number: { gte: params.from_number }, recurrence_id: series.id },
      });
      const payments = series.credit_card_id
        ? await tx.financialInvoicePayment.findMany({
            select: { invoice_month: true },
            where: { credit_card_id: series.credit_card_id },
          })
        : [];
      const paidMonths = new Set(payments.map((payment) => payment.invoice_month));
      const refunded = await tx.financialTransaction.findMany({
        select: { refunded_transaction_id: true },
        where: { refunded_transaction_id: { in: rows.map((row) => row.id) } },
      });
      const refundedIds = new Set(refunded.map((row) => row.refunded_transaction_id));
      const kept = rows.filter(
        (row) =>
          Boolean(row.credit_card_id && paidMonths.has(row.invoice_month as string)) ||
          refundedIds.has(row.id),
      );
      const keptIds = new Set(kept.map((row) => row.id));
      const removable = rows.filter((row) => !keptIds.has(row.id));
      const paidRows = removable.filter((row) => row.account_id && row.paid === true);

      if (kept.length > 0 && !params.detach_locked) {
        throw new UnprocessableEntityException(
          kept.some((row) => refundedIds.has(row.id))
            ? 'Delete its refunds first'
            : 'An occurrence is in a paid invoice',
        );
      }
      if (paidRows.length > 0 && !params.confirm_paid) {
        throw new ConflictException({
          detachedCount: kept.length,
          message: 'Paid occurrences',
          paidCount: paidRows.length,
          paidTotal: paidRows.reduce((total, row) => total + row.value, 0),
        });
      }

      if (kept.length > 0) {
        await tx.financialTransaction.updateMany({
          data: { occurrence_number: null, recurrence_id: null },
          where: { id: { in: [...keptIds] } },
        });
      }
      if (removable.length > 0) {
        await tx.financialTransaction.deleteMany({
          where: { id: { in: removable.map((row) => row.id) } },
        });
        await applyLedgerDeltas(tx, reversalOf(paidRows));
      }

      if (params.delete_series) {
        await tx.financialRecurrence.delete({ where: { id: series.id } });
      } else if (params.series_patch) {
        await tx.financialRecurrence.update({
          data: params.series_patch,
          where: { id: series.id },
        });
      }

      return { deleted: removable.length, detached: kept.length };
    });
  }

  // Appends to `skipped_numbers` under the series lock so a concurrent materialization sees it.
  async skipNumber(id: string, occurrenceNumber: number): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockSeries(tx, id);
      await tx.financialRecurrence.update({
        data: { skipped_numbers: { push: occurrenceNumber } },
        where: { id },
      });
    });
  }

  // The series, its real rows and the ledger of the paid ones commit together (spec 034 FR 18).
  async create(params: CreateRecurrenceDatasourceParams): Promise<string> {
    return this.db.client.$transaction(async (tx) => {
      if (params.credit_card_id) {
        await lockCards(tx, [params.credit_card_id]);
        await assertInvoicesNotPaid(
          tx,
          params.credit_card_id,
          params.rows.map((row) => row.invoice_month as string),
        );
      }

      const series = await tx.financialRecurrence.create({
        data: {
          account_id: params.account_id,
          category_id: params.category_id,
          credit_card_id: params.credit_card_id,
          description: params.description,
          end_date: params.end_date,
          frequency: params.frequency,
          last_generated_number: params.last_generated_number,
          next_occurrence_date: params.next_occurrence_date,
          owner: params.owner,
          owner_id: params.owner_id,
          start_date: params.start_date,
          status: params.status,
          type: params.type,
          value: params.value,
        },
        select: { id: true },
      });
      const template: SeriesTemplate = {
        account_id: params.account_id ?? null,
        category_id: params.category_id,
        credit_card_id: params.credit_card_id ?? null,
        description: params.description,
        owner: params.owner,
        owner_id: params.owner_id,
        type: params.type,
        value: params.value,
      };
      const rows = toRows(params.rows, template, series.id);

      if (rows.length > 0) {
        await tx.financialTransaction.createMany({ data: rows });
        for (const row of rows) {
          const entry = toLedgerEntry({
            account_id: row.account_id ?? null,
            paid: row.paid ?? null,
            type: row.type,
            value: row.value,
          });

          await applyLedgerDeltas(tx, ledgerDeltas(undefined, entry));
        }
      }

      return series.id;
    });
  }

  // The real row of a projected occurrence (FR 21): the series is not advanced; the unique
  // `(recurrence_id, occurrence_number)` makes the horizon skip it later and refuses a second one.
  async createOccurrence(
    params: CreateOccurrenceDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.$transaction(async (tx) => {
      const series = await tx.financialRecurrence.findUnique({
        where: { id: params.recurrence_id },
      });

      if (!series) {
        throw new NotFoundException();
      }

      await lockCards(tx, series.credit_card_id ? [series.credit_card_id] : []);
      await lockSeries(tx, series.id);
      await assertInvoiceNotPaid(tx, series.credit_card_id, params.invoice_month);

      const existing = await tx.financialTransaction.findFirst({
        select: { id: true },
        where: { occurrence_number: params.number, recurrence_id: series.id },
      });

      if (existing) {
        throw new ConflictException('Occurrence already exists');
      }

      const [data] = toRows(
        [
          {
            date: params.date,
            invoice_month: params.invoice_month,
            number: params.number,
            paid: params.paid,
          },
        ],
        {
          ...series,
          category_id: params.category_id ?? series.category_id,
          description: params.description ?? series.description,
          value: params.value ?? series.value,
        },
        series.id,
      );
      const created = await tx.financialTransaction.create({
        data,
        include: TRANSACTION_RELATIONS,
      });

      await applyLedgerDeltas(tx, ledgerDeltas(undefined, toLedgerEntry(created)));

      return created;
    });
  }

  async findById(id: string): Promise<FinancialRecurrenceWithRelations | null> {
    return this.db.client.financialRecurrence.findUnique({
      include: RECURRENCE_RELATIONS,
      where: { id },
    });
  }

  async findByOwners(
    owners: OwnerAccess[],
    filter: FindRecurrencesDatasourceFilter = {},
  ): Promise<FinancialRecurrenceWithRelations[]> {
    return this.db.client.financialRecurrence.findMany({
      include: RECURRENCE_RELATIONS,
      orderBy: [{ start_date: 'asc' }, { created_at: 'asc' }],
      where: {
        AND: [
          toOwnerWhere(owners),
          {
            account_id: filter.account_id,
            credit_card_id: filter.credit_card_id,
            status: filter.status,
          },
        ],
      },
    });
  }

  // One indexed query: `(owner, owner_id, status, next_occurrence_date)`.
  async findDue(owners: OwnerAccess[], horizon: Date): Promise<FinancialRecurrenceWithRelations[]> {
    return this.db.client.financialRecurrence.findMany({
      include: RECURRENCE_RELATIONS,
      where: {
        AND: [toOwnerWhere(owners), { next_occurrence_date: { lte: horizon }, status: 'ACTIVE' }],
      },
    });
  }

  async findFutureNumbers(
    recurrenceIds: string[],
    afterDate: Date,
  ): Promise<FutureOccurrenceNumberRow[]> {
    if (recurrenceIds.length === 0) {
      return [];
    }

    const rows = await this.db.client.financialTransaction.findMany({
      select: { occurrence_number: true, recurrence_id: true },
      where: { date: { gt: afterDate }, recurrence_id: { in: recurrenceIds } },
    });

    return rows.map((row) => ({
      occurrence_number: row.occurrence_number as number,
      recurrence_id: row.recurrence_id as string,
    }));
  }

  async findOccurrences(recurrenceId: string): Promise<FinancialTransactionWithRelations[]> {
    return this.db.client.financialTransaction.findMany({
      include: TRANSACTION_RELATIONS,
      orderBy: { occurrence_number: 'asc' },
      where: { recurrence_id: recurrenceId },
    });
  }

  // Locks the series row; a concurrent read that already advanced it makes this one a no-op, and the
  // unique `(recurrence_id, occurrence_number)` protects against any other overlap (spec 034 FR 9).
  async materialize(params: MaterializeRecurrenceDatasourceParams): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        {
          account_id: null | string;
          category_id: string;
          credit_card_id: null | string;
          description: string;
          last_generated_number: number;
          owner: SeriesTemplate['owner'];
          owner_id: string;
          type: SeriesTemplate['type'];
          value: number;
        }[]
      >(
        Prisma.sql`SELECT "account_id", "category_id", "credit_card_id", "description", "last_generated_number", "owner"::text AS "owner", "owner_id", "type"::text AS "type", "value" FROM "financial_recurrences" WHERE "id" = ${params.id} FOR UPDATE`,
      );

      if (locked.length === 0 || locked[0].last_generated_number !== params.expected_last) {
        return;
      }

      if (params.rows.length > 0) {
        await tx.financialTransaction.createMany({
          data: toRows(params.rows, locked[0], params.id),
          skipDuplicates: true,
        });
      }

      await tx.financialRecurrence.update({
        data: {
          last_generated_number: params.last_generated_number,
          next_occurrence_date: params.next_occurrence_date,
          status: params.status,
        },
        where: { id: params.id },
      });
    });
  }
}

// Account rows carry `paid` (default false); card rows leave it NULL and keep the invoice month.
function toRows(
  rows: OccurrenceRowDatasourceParams[],
  template: SeriesTemplate,
  recurrenceId: string,
): Prisma.FinancialTransactionCreateManyInput[] {
  return rows.map((row) => ({
    account_id: template.account_id,
    category_id: template.category_id,
    credit_card_id: template.credit_card_id,
    date: row.date,
    description: template.description,
    invoice_month: row.invoice_month ?? null,
    occurrence_number: row.number,
    owner: template.owner,
    owner_id: template.owner_id,
    paid: template.account_id ? (row.paid ?? false) : null,
    recurrence_id: recurrenceId,
    type: template.type,
    value: template.value,
  }));
}

// Serializes this change with the materialization of the same series.
async function lockSeries(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "financial_recurrences" WHERE "id" = ${id} FOR UPDATE`,
  );
}
// The template new rows of a replace take: the new series when there is one, else the source with its patch.
function templateOf(
  source: SeriesTemplate,
  params: ApplyRecurrenceChangeDatasourceParams,
): SeriesTemplate {
  const base = params.new_series ?? {
    ...source,
    ...Object.fromEntries(
      Object.entries(params.series_patch).filter(([, value]) => value !== undefined),
    ),
  };

  return {
    account_id: base.account_id ?? null,
    category_id: base.category_id,
    credit_card_id: base.credit_card_id ?? null,
    description: base.description,
    owner: base.owner,
    owner_id: base.owner_id,
    type: base.type,
    value: base.value,
  };
}

// One delta per account (net, ascending id), undoing every paid row that goes away.
function reversalOf(
  rows: { account_id: null | string; paid: boolean | null; type: string; value: number }[],
): LedgerDelta[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    for (const { accountId, delta } of ledgerDeltas(toLedgerEntry(row), undefined)) {
      totals.set(accountId, (totals.get(accountId) ?? 0) + delta);
    }
  }

  return [...totals.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([accountId, delta]) => ({ accountId, delta }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}
