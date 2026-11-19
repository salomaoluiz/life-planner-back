import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { Prisma } from '@db/client';
import {
  CardInvoiceKey,
  invoiceTotalsKeysOf,
  refreshCardInvoiceTotals,
} from '@finance/data/datasource/cardInvoiceTotals';
import { TRANSACTION_RELATIONS } from '@finance/data/datasource/FinanceTransactionDatasource';
import {
  applyLedgerDeltas,
  assertInvoiceNotPaid,
  lockAccounts,
  lockCards,
  sumLedgerDeltas,
  toLedgerEntry,
} from '@finance/data/datasource/ledger';
import { applyTagNames } from '@finance/data/datasource/tags';
import {
  FinancialSplitRecord,
  FinancialSplitSummaryRecord,
  IFinanceSplitDatasource,
  UpdateSplitDatasourceResult,
  WriteSplitDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceSplitDatasource';
import { LedgerDelta, ledgerDeltas } from '@finance/domain/service/LedgerBalance';
import { Database } from '@shared/infra/db/Database';

const SPLIT_INCLUDE = {
  transactions: {
    include: TRANSACTION_RELATIONS,
    orderBy: { split_position: 'asc' },
  },
} as const;
const ROW_SELECT = {
  account_id: true,
  credit_card_id: true,
  id: true,
  invoice_month: true,
  paid: true,
  type: true,
  value: true,
} as const;

type RowScalars = Prisma.FinancialTransactionGetPayload<{ select: typeof ROW_SELECT }>;

export const SPLIT_PART_NOT_FOUND = 'Split part not found';

// FR 3-5: what every part shares comes from the header; the part owns type, category, value, own description, tags.
function accountIdsOf(...rows: { account_id: null | string }[]): string[] {
  return rows.flatMap((row) => (row.account_id ? [row.account_id] : []));
}
function cardIdsOf(...rows: { credit_card_id: null | string }[]): string[] {
  return rows.flatMap((row) => (row.credit_card_id ? [row.credit_card_id] : []));
}
function headerData(params: WriteSplitDatasourceParams) {
  return {
    account_id: params.account_id,
    credit_card_id: params.credit_card_id,
    currency: params.currency,
    date: params.date,
    description: params.description,
    invoice_month: params.invoice_month,
    notes: params.notes,
    owner: params.owner,
    owner_id: params.owner_id,
    paid: params.account_id === null ? null : (params.paid ?? false),
  };
}
async function lockSplitRow(tx: Prisma.TransactionClient, id: string) {
  return tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "financial_splits" WHERE "id" = ${id} FOR UPDATE`,
  );
}
function rowData(
  params: WriteSplitDatasourceParams,
  part: WriteSplitDatasourceParams['parts'][number],
  position: number,
  split: { createdAt: Date; id: string },
) {
  return {
    // Every part shares the header's created_at so the list keeps a split's rows adjacent (FR 30).
    account_id: params.account_id,
    category_id: part.category_id,
    created_at: split.createdAt,
    credit_card_id: params.credit_card_id,
    currency: params.currency,
    date: params.date,
    description: part.description ?? params.description,
    description_inherited: part.description === null,
    invoice_month: params.invoice_month,
    notes: params.notes,
    occurrence_number: null,
    owner: params.owner,
    owner_id: params.owner_id,
    paid: params.account_id === null ? null : (params.paid ?? false),
    // The series position lives on the header (FR 3 deviation: parts would break the row unique key).
    recurrence_id: null,
    split_id: split.id,
    split_position: position,
    type: part.type,
    value: part.value,
  } satisfies Prisma.FinancialTransactionUncheckedUpdateInput;
}

// Names of a kept or created part are resolved in the owner and replace the row's tags.
interface SplitWriteResult {
  deltas: LedgerDelta[];
  id: string;
  invoiceKeys: CardInvoiceKey[];
}

async function tagPart(
  tx: Prisma.TransactionClient,
  params: WriteSplitDatasourceParams,
  rowId: string,
  names: string[] | undefined,
  created: boolean,
): Promise<void> {
  if (names === undefined || (created && names.length === 0)) {
    return;
  }
  await applyTagNames(tx, {
    names,
    owner: params.owner,
    ownerId: params.owner_id,
    where: { id: rowId },
  });
}

// Header and parts of a NEW split (or a saved transaction converted into its first part, FR 16). The caller holds the
// locks and applies the ledger and the invoice totals.
async function insertSplit(
  tx: Prisma.TransactionClient,
  params: WriteSplitDatasourceParams,
): Promise<SplitWriteResult> {
  const header = await tx.financialSplit.create({
    data: {
      ...headerData(params),
      created_by: params.created_by,
      occurrence_number: params.occurrence_number,
      recurrence_id: params.recurrence_id,
    },
    select: { created_at: true, id: true },
  });
  const deltas: LedgerDelta[] = [];
  const invoiceKeys: Pick<RowScalars, 'credit_card_id' | 'invoice_month'>[] = [
    { credit_card_id: params.credit_card_id, invoice_month: params.invoice_month },
  ];

  for (const [position, part] of params.parts.entries()) {
    const data = rowData(params, part, position, { createdAt: header.created_at, id: header.id });

    if (position === 0 && params.source_transaction_id !== undefined) {
      const before = await tx.financialTransaction.findUnique({
        select: ROW_SELECT,
        where: { id: params.source_transaction_id },
      });

      if (!before) {
        throw new NotFoundException('Transaction not found');
      }
      await assertInvoiceNotPaid(tx, before.credit_card_id, before.invoice_month);
      const after = await tx.financialTransaction.update({
        data,
        select: ROW_SELECT,
        where: { id: before.id },
      });

      deltas.push(...ledgerDeltas(toLedgerEntry(before), toLedgerEntry(after)));
      invoiceKeys.push(before);
      await tagPart(tx, params, before.id, part.tag_names, false);
      continue;
    }
    const created = await tx.financialTransaction.create({
      data: data as Prisma.FinancialTransactionUncheckedCreateInput,
      select: ROW_SELECT,
    });

    deltas.push(...ledgerDeltas(undefined, toLedgerEntry(created)));
    await tagPart(tx, params, created.id, part.tag_names, true);
  }

  return { deltas, id: header.id, invoiceKeys: invoiceTotalsKeysOf(invoiceKeys) };
}

@Injectable()
export class FinanceSplitDatasource implements IFinanceSplitDatasource {
  constructor(private readonly db: Database) {}

  // FR 15: the header, every part, the ledgers (summed per account) and the invoice totals in ONE transaction.
  async create(params: WriteSplitDatasourceParams): Promise<FinancialSplitRecord> {
    const id = await this.db.client.$transaction(async (tx) => {
      const source =
        params.source_transaction_id === undefined
          ? undefined
          : await tx.financialTransaction.findUnique({
              select: ROW_SELECT,
              where: { id: params.source_transaction_id },
            });

      await lockCards(tx, [...cardIdsOf(params), ...cardIdsOf(source ?? params)]);
      await lockAccounts(tx, [...accountIdsOf(params), ...accountIdsOf(source ?? params)]);
      await assertInvoiceNotPaid(tx, params.credit_card_id, params.invoice_month);
      const written = await insertSplit(tx, params);

      await applyLedgerDeltas(tx, sumLedgerDeltas(written.deltas));
      await refreshCardInvoiceTotals(tx, written.invoiceKeys);

      return written.id;
    });

    return this.db.client.financialSplit.findUniqueOrThrow({
      include: SPLIT_INCLUDE,
      where: { id },
    }) as Promise<FinancialSplitRecord>;
  }

  // Spec 119 FR 38 (CSV import): all splits or none.
  async createMany(params: WriteSplitDatasourceParams[]): Promise<number> {
    if (params.length === 0) {
      return 0;
    }

    return this.db.client.$transaction(
      async (tx) => {
        await lockCards(
          tx,
          params.flatMap((item) => cardIdsOf(item)),
        );
        await lockAccounts(
          tx,
          params.flatMap((item) => accountIdsOf(item)),
        );
        const deltas: LedgerDelta[] = [];
        const keys: CardInvoiceKey[] = [];

        for (const item of params) {
          await assertInvoiceNotPaid(tx, item.credit_card_id, item.invoice_month);
          const written = await insertSplit(tx, item);

          deltas.push(...written.deltas);
          keys.push(...written.invoiceKeys);
        }
        await applyLedgerDeltas(tx, sumLedgerDeltas(deltas));
        await refreshCardInvoiceTotals(tx, keys);

        return params.length;
      },
      { timeout: 30000 },
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockSplitRow(tx, id);
      const existing = await tx.financialSplit.findUnique({
        select: {
          account_id: true,
          credit_card_id: true,
          invoice_month: true,
          transactions: { select: ROW_SELECT },
        },
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Split not found');
      }
      await lockCards(tx, cardIdsOf(existing));
      await lockAccounts(tx, accountIdsOf(existing));
      await assertInvoiceNotPaid(tx, existing.credit_card_id, existing.invoice_month);
      await tx.financialTransaction.deleteMany({ where: { split_id: id } });
      await applyLedgerDeltas(
        tx,
        sumLedgerDeltas(
          existing.transactions.flatMap((row) => ledgerDeltas(toLedgerEntry(row), undefined)),
        ),
      );
      await refreshCardInvoiceTotals(tx, invoiceTotalsKeysOf([existing]));
      await tx.financialSplit.delete({ where: { id } });
    });
  }

  async findById(id: string): Promise<FinancialSplitRecord | null> {
    return this.db.client.financialSplit.findUnique({
      include: SPLIT_INCLUDE,
      where: { id },
    }) as Promise<FinancialSplitRecord | null>;
  }

  async findByIds(ids: string[]): Promise<FinancialSplitRecord[]> {
    return this.db.client.financialSplit.findMany({
      include: SPLIT_INCLUDE,
      where: { id: { in: ids } },
    }) as Promise<FinancialSplitRecord[]>;
  }

  // One query for the headers and the amounts of the splits a page references (FR 27).
  async findSummaries(ids: string[]): Promise<FinancialSplitSummaryRecord[]> {
    return this.db.client.financialSplit.findMany({
      include: { transactions: { select: { type: true, value: true } } },
      where: { id: { in: ids } },
    }) as Promise<FinancialSplitSummaryRecord[]>;
  }

  // FR 19: only `paid` changes, on the header and on every part (account splits).
  async setPaid(id: string, paid: boolean): Promise<FinancialSplitRecord> {
    await this.db.client.$transaction(async (tx) => {
      await lockSplitRow(tx, id);
      const existing = await tx.financialSplit.findUnique({
        select: { account_id: true, transactions: { select: ROW_SELECT } },
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Split not found');
      }
      await lockAccounts(tx, accountIdsOf(existing));
      const deltas = existing.transactions.flatMap((row) =>
        ledgerDeltas(toLedgerEntry(row), toLedgerEntry({ ...row, paid })),
      );

      await tx.financialTransaction.updateMany({ data: { paid }, where: { split_id: id } });
      await tx.financialSplit.update({ data: { paid }, where: { id } });
      await applyLedgerDeltas(tx, sumLedgerDeltas(deltas));
    });

    return this.findById(id) as Promise<FinancialSplitRecord>;
  }

  // FR 18, 22: kept parts are updated in place, new ones created, missing ones deleted; one part left dissolves the split.
  async update(
    id: string,
    params: WriteSplitDatasourceParams,
  ): Promise<UpdateSplitDatasourceResult> {
    const dissolvedId = await this.db.client.$transaction(async (tx) => {
      await lockSplitRow(tx, id);
      const existing = await tx.financialSplit.findUnique({
        select: {
          account_id: true,
          created_at: true,
          credit_card_id: true,
          invoice_month: true,
          transactions: { select: ROW_SELECT },
        },
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Split not found');
      }
      await lockCards(tx, [...cardIdsOf(existing), ...cardIdsOf(params)]);
      await lockAccounts(tx, [...accountIdsOf(existing), ...accountIdsOf(params)]);
      await assertInvoiceNotPaid(tx, existing.credit_card_id, existing.invoice_month);
      await assertInvoiceNotPaid(tx, params.credit_card_id, params.invoice_month);

      const stored = new Map(existing.transactions.map((row) => [row.id, row]));
      const keptIds = new Set(params.parts.flatMap((part) => (part.id ? [part.id] : [])));
      const deltas: LedgerDelta[] = [];

      for (const part of params.parts) {
        if (part.id !== undefined && !stored.has(part.id)) {
          throw new UnprocessableEntityException(SPLIT_PART_NOT_FOUND);
        }
      }
      for (const row of existing.transactions) {
        if (!keptIds.has(row.id)) {
          await tx.financialTransaction.delete({ where: { id: row.id } });
          deltas.push(...ledgerDeltas(toLedgerEntry(row), undefined));
        }
      }
      for (const [position, part] of params.parts.entries()) {
        const data = rowData(params, part, position, { createdAt: existing.created_at, id });

        if (part.id !== undefined) {
          const before = stored.get(part.id) as RowScalars;
          const after = await tx.financialTransaction.update({
            data,
            select: ROW_SELECT,
            where: { id: part.id },
          });

          deltas.push(...ledgerDeltas(toLedgerEntry(before), toLedgerEntry(after)));
          await tagPart(tx, params, part.id, part.tag_names, false);
        } else {
          const created = await tx.financialTransaction.create({
            data: data as Prisma.FinancialTransactionUncheckedCreateInput,
            select: ROW_SELECT,
          });

          deltas.push(...ledgerDeltas(undefined, toLedgerEntry(created)));
          await tagPart(tx, params, created.id, part.tag_names, true);
        }
      }
      await tx.financialSplit.update({ data: headerData(params), where: { id } });
      await applyLedgerDeltas(tx, sumLedgerDeltas(deltas));
      await refreshCardInvoiceTotals(
        tx,
        invoiceTotalsKeysOf([
          existing,
          { credit_card_id: params.credit_card_id, invoice_month: params.invoice_month },
        ]),
      );

      if (params.parts.length > 1) {
        return undefined;
      }

      const [last] = await tx.financialTransaction.findMany({
        select: { id: true },
        where: { split_id: id },
      });

      if (!last) {
        throw new BadRequestException('A split keeps at least one part');
      }
      await tx.financialTransaction.update({
        data: { description_inherited: false, split_id: null, split_position: null },
        where: { id: last.id },
      });
      await tx.financialSplit.delete({ where: { id } });

      return last.id;
    });

    if (dissolvedId !== undefined) {
      return { dissolved_id: dissolvedId };
    }

    return { split: (await this.findById(id)) as FinancialSplitRecord };
  }
}
