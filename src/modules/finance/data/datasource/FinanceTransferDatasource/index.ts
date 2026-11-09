import { Injectable, NotFoundException } from '@nestjs/common';

import { OwnerType, Prisma } from '@db/client';
import {
  applyLedgerDeltas,
  lockAccounts,
  sumLedgerDeltas,
  toLedgerEntry,
} from '@finance/data/datasource/ledger';
import {
  FinancialTransferRecord,
  IFinanceTransferDatasource,
  WriteTransferDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceTransferDatasource';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey } from '@finance/domain/enum';
import { LedgerDelta, ledgerDeltas } from '@finance/domain/service/LedgerBalance';
import { Database } from '@shared/infra/db/Database';

const TRANSFER_INCLUDE = { transactions: { select: { category_id: true, id: true } } } as const;
const ROW_SELECT = { account_id: true, category_id: true, id: true, paid: true, type: true, value: true } as const;

interface PlannedRow {
  categoryId: string;
  data: Prisma.FinancialTransactionUncheckedCreateInput;
}

// Spec 098 FR 2: the out row (origin), the in row (destination, only once the amount in is known) and the fee row
// (destination, dated with the in side) are ordinary transactions that follow the transfer's `paid`.
function planRows(params: WriteTransferDatasourceParams): PlannedRow[] {
  const common = {
    description: params.description,
    notes: params.notes,
    paid: params.paid,
  };
  const rows: PlannedRow[] = [
    {
      categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_OUT],
      data: {
        ...common,
        account_id: params.from.account_id,
        category_id: SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_OUT],
        currency: params.from.currency,
        date: params.date_out,
        owner: params.from.owner as OwnerType,
        owner_id: params.from.owner_id,
        type: 'EXPENSE',
        value: params.amount_out,
      },
    },
  ];

  if (params.amount_in !== null) {
    rows.push({
      categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_IN],
      data: {
        ...common,
        account_id: params.to.account_id,
        category_id: SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_IN],
        currency: params.to.currency,
        date: params.date_in,
        owner: params.to.owner as OwnerType,
        owner_id: params.to.owner_id,
        type: 'INCOME',
        value: params.amount_in,
      },
    });
  }

  if (params.fee !== null) {
    rows.push({
      categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_FEE],
      data: {
        ...common,
        account_id: params.to.account_id,
        category_id: SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_FEE],
        currency: params.to.currency,
        date: params.date_in,
        owner: params.to.owner as OwnerType,
        owner_id: params.to.owner_id,
        type: 'EXPENSE',
        value: params.fee,
      },
    });
  }

  return rows;
}

function transferData(params: WriteTransferDatasourceParams) {
  return {
    amount_in: params.amount_in,
    amount_out: params.amount_out,
    currency_in: params.to.currency,
    currency_out: params.from.currency,
    date_in: params.date_in,
    date_out: params.date_out,
    description: params.description,
    fee: params.fee,
    from_account_id: params.from.account_id,
    notes: params.notes,
    paid: params.paid,
    to_account_id: params.to.account_id,
  };
}

function lockTransferRow(tx: Prisma.TransactionClient, id: string) {
  return tx.$queryRaw(Prisma.sql`SELECT "id" FROM "financial_transfers" WHERE "id" = ${id} FOR UPDATE`);
}

function accountIdsOf(transfer: { from_account_id: null | string; to_account_id: null | string }): string[] {
  return [transfer.from_account_id, transfer.to_account_id].filter((id): id is string => id !== null);
}

@Injectable()
export class FinanceTransferDatasource implements IFinanceTransferDatasource {
  constructor(private readonly db: Database) {}

  // The transfer, its rows and both ledgers change in ONE database transaction, accounts locked in id order.
  async create(params: WriteTransferDatasourceParams): Promise<FinancialTransferRecord> {
    return this.db.client.$transaction(async (tx) => {
      await lockAccounts(tx, [params.from.account_id, params.to.account_id]);
      const transfer = await tx.financialTransfer.create({
        data: {
          ...transferData(params),
          created_by: params.created_by,
          occurrence_number: params.occurrence_number,
          recurrence_id: params.recurrence_id,
        },
        select: { id: true },
      });
      const deltas: LedgerDelta[] = [];

      for (const row of planRows(params)) {
        const created = await tx.financialTransaction.create({
          data: { ...row.data, transfer_id: transfer.id },
          select: ROW_SELECT,
        });
        deltas.push(...ledgerDeltas(undefined, toLedgerEntry(created)));
      }
      await applyLedgerDeltas(tx, sumLedgerDeltas(deltas));

      return tx.financialTransfer.findUniqueOrThrow({
        include: TRANSFER_INCLUDE,
        where: { id: transfer.id },
      });
    }) as Promise<FinancialTransferRecord>;
  }

  async delete(id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockTransferRow(tx, id);
      const existing = await tx.financialTransfer.findUnique({
        select: { from_account_id: true, to_account_id: true, transactions: { select: ROW_SELECT } },
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Transfer not found');
      }
      await lockAccounts(tx, [
        ...accountIdsOf(existing),
        ...existing.transactions.map((row) => row.account_id).filter((value): value is string => value !== null),
      ]);
      const deltas = existing.transactions.flatMap((row) => ledgerDeltas(toLedgerEntry(row), undefined));

      await tx.financialTransaction.deleteMany({ where: { transfer_id: id } });
      await applyLedgerDeltas(tx, sumLedgerDeltas(deltas));
      await tx.financialTransfer.delete({ where: { id } });
    });
  }

  async findByIds(ids: string[]): Promise<FinancialTransferRecord[]> {
    return this.db.client.financialTransfer.findMany({
      include: TRANSFER_INCLUDE,
      where: { id: { in: ids } },
    }) as Promise<FinancialTransferRecord[]>;
  }

  async findById(id: string): Promise<FinancialTransferRecord | null> {
    return this.db.client.financialTransfer.findUnique({
      include: TRANSFER_INCLUDE,
      where: { id },
    }) as Promise<FinancialTransferRecord | null>;
  }

  // Rows are rewritten in place (same ids); a row whose side disappeared (the fee) is deleted and a new one (the in row
  // once the amount in is known) is created. The net change of each ledger is applied once, in account id order.
  async update(id: string, params: WriteTransferDatasourceParams): Promise<FinancialTransferRecord> {
    return this.db.client.$transaction(async (tx) => {
      await lockTransferRow(tx, id);
      const existing = await tx.financialTransfer.findUnique({
        select: { from_account_id: true, to_account_id: true, transactions: { select: ROW_SELECT } },
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Transfer not found');
      }
      await lockAccounts(tx, [
        ...accountIdsOf(existing),
        params.from.account_id,
        params.to.account_id,
      ]);
      const planned = planRows(params);
      const deltas: LedgerDelta[] = [];

      for (const row of existing.transactions) {
        if (!planned.some((item) => item.categoryId === row.category_id)) {
          await tx.financialTransaction.delete({ where: { id: row.id } });
          deltas.push(...ledgerDeltas(toLedgerEntry(row), undefined));
        }
      }
      for (const item of planned) {
        const stored = existing.transactions.find((row) => row.category_id === item.categoryId);

        if (stored) {
          const updated = await tx.financialTransaction.update({
            data: item.data,
            select: ROW_SELECT,
            where: { id: stored.id },
          });
          deltas.push(...ledgerDeltas(toLedgerEntry(stored), toLedgerEntry(updated)));
        } else {
          const created = await tx.financialTransaction.create({
            data: { ...item.data, transfer_id: id },
            select: ROW_SELECT,
          });
          deltas.push(...ledgerDeltas(undefined, toLedgerEntry(created)));
        }
      }
      await applyLedgerDeltas(tx, sumLedgerDeltas(deltas));
      await tx.financialTransfer.update({ data: transferData(params), where: { id } });

      return tx.financialTransfer.findUniqueOrThrow({ include: TRANSFER_INCLUDE, where: { id } });
    }) as Promise<FinancialTransferRecord>;
  }
}
