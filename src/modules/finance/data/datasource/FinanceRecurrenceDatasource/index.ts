import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { Prisma } from '@db/client';
import { TRANSACTION_RELATIONS } from '@finance/data/datasource/FinanceTransactionDatasource';
import {
  applyLedgerDeltas,
  assertInvoicesNotPaid,
  lockCards,
  toLedgerEntry,
} from '@finance/data/datasource/ledger';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  ApplyRecurrenceChangeDatasourceParams,
  CreateRecurrenceDatasourceParams,
  FinancialRecurrenceWithRelations,
  FindRecurrencesDatasourceFilter,
  FutureOccurrenceNumberRow,
  IFinanceRecurrenceDatasource,
  MaterializeRecurrenceDatasourceParams,
  OccurrenceRowDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceRecurrenceDatasource';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { ledgerDeltas } from '@finance/domain/service/LedgerBalance';
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
