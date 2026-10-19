import { Injectable } from '@nestjs/common';

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
