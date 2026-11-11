import { Injectable, NotFoundException } from '@nestjs/common';

import { InvestmentIncomeEvent, OwnerType, Prisma } from '@db/client';
import {
  applyDeltas,
  ledgerDeltasFor,
  LinkedRow,
  lockAccounts,
  lockAsset,
} from '@investment/data/datasource/financeLink';
import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import { toOwnerWhere } from '@investment/data/datasource/mapper/OwnerWhere';
import {
  CategoryRow,
  IIncomeDatasource,
  IncomeRow,
  SuggestionInputsRow,
  SuggestionRow,
} from '@investment/data/repository/datasource/IIncomeDatasource';
import {
  IncomeEventUpsert,
  IncomeFilter,
  WriteIncomeParams,
} from '@investment/domain/entity/IncomeEntity';
import { Database } from '@shared/infra/db/Database';

const ROW_SELECT = { account_id: true, category_id: true, paid: true } as const;
const LINKED_SELECT = { account_id: true, paid: true, type: true, value: true } as const;
const INCOME_INCLUDE = {
  asset: { select: { asset_class: true } },
  transaction: { select: ROW_SELECT },
} as const;

@Injectable()
export class IncomeDatasource implements IIncomeDatasource {
  constructor(private readonly db: Database) {}

  async countPendingSuggestions(assetId: string): Promise<number> {
    return this.db.client.investmentIncomeSuggestion.count({
      where: { asset_id: assetId, status: 'PENDING' },
    });
  }

  async createSuggestions(
    rows: { asset_id: string; event_id: string; quantity: string }[],
  ): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const result = await this.db.client.investmentIncomeSuggestion.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return result.count;
  }

  async deleteIncome(id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const existing = await tx.investmentIncome.findUnique({
        include: { transaction: { select: LINKED_SELECT } },
        where: { id },
      });

      if (!existing) {
        return;
      }

      await lockAsset(tx, existing.asset_id);
      await lockAccounts(
        tx,
        existing.transaction?.account_id ? [existing.transaction.account_id] : [],
      );
      await tx.investmentIncome.delete({ where: { id } });

      if (existing.transaction_id) {
        await tx.financialTransaction.delete({ where: { id: existing.transaction_id } });
      }

      // Only a received row ever moved the ledger (spec 033).
      await applyDeltas(
        tx,
        ledgerDeltasFor(existing.transaction?.paid ? toLinkedRow(existing.transaction) : undefined),
      );

      // FR 21: an income that came from a suggestion never comes back.
      if (existing.suggestion_id) {
        await tx.investmentIncomeSuggestion.update({
          data: { status: 'DISMISSED' },
          where: { id: existing.suggestion_id },
        });
      }
    });
  }

  async findCategoryById(id: string): Promise<CategoryRow | null> {
    return this.db.client.financialCategory.findUnique({
      include: { scopes: true },
      where: { id },
    });
  }

  // The earliest BUY (by date, creation, id) that has a finance row.
  async findDefaultAccountId(assetId: string): Promise<null | string> {
    const operation = await this.db.client.investmentOperation.findFirst({
      orderBy: [{ date: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      select: { account_id: true },
      where: {
        account_id: { not: null },
        asset_id: assetId,
        transaction_id: { not: null },
        type: 'BUY',
      },
    });

    return operation?.account_id ?? null;
  }

  async findEvents(
    keys: { market: string; ticker: string }[],
    sinceExDate: Date,
  ): Promise<InvestmentIncomeEvent[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.db.client.investmentIncomeEvent.findMany({
      orderBy: [{ ex_date: 'asc' }, { id: 'asc' }],
      where: {
        ex_date: { gte: sinceExDate },
        OR: keys.map((key) => ({ market: key.market as 'B3' | 'US', ticker: key.ticker })),
      },
    });
  }

  async findIncomeById(id: string): Promise<IncomeRow | null> {
    return this.db.client.investmentIncome.findUnique({ include: INCOME_INCLUDE, where: { id } });
  }

  async findIncomeByTransactionId(transactionId: string) {
    return this.db.client.investmentIncome.findUnique({
      select: { asset_id: true, id: true },
      where: { transaction_id: transactionId },
    });
  }

  // Keyset on `(payment_date desc, id desc)`; the caller asks for `limit + 1` rows to know if there is a next page.
  async findIncomes(filter: IncomeFilter): Promise<IncomeRow[]> {
    const and: Prisma.InvestmentIncomeWhereInput[] = [];

    if (filter.cursor) {
      const date = InvestmentMapper.fromCalendarDate(filter.cursor.paymentDate);

      and.push({
        OR: [{ payment_date: { lt: date } }, { id: { lt: filter.cursor.id }, payment_date: date }],
      });
    }
    if (filter.status) {
      and.push({ transaction: { paid: filter.status === 'RECEIVED' } });
    }

    return this.db.client.investmentIncome.findMany({
      include: INCOME_INCLUDE,
      orderBy: [{ payment_date: 'desc' }, { id: 'desc' }],
      take: filter.limit,
      where: {
        AND: and,
        ...(filter.assetId ? { asset_id: filter.assetId } : { asset: toOwnerWhere(filter.owners) }),
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.from || filter.to
          ? {
              payment_date: {
                ...(filter.from ? { gte: InvestmentMapper.fromCalendarDate(filter.from) } : {}),
                ...(filter.to ? { lte: InvestmentMapper.fromCalendarDate(filter.to) } : {}),
              },
            }
          : {}),
      },
    });
  }

  async findLastIncomeCategoryId(
    owner: OwnerType,
    ownerId: string,
    type: string,
  ): Promise<null | string> {
    const income = await this.db.client.investmentIncome.findFirst({
      orderBy: [{ payment_date: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
      select: { transaction: { select: { category_id: true } } },
      where: {
        asset: { owner, owner_id: ownerId },
        transaction_id: { not: null },
        type: type as 'DIVIDEND',
      },
    });

    return income?.transaction?.category_id ?? null;
  }

  async findPendingSuggestions(assetIds: string[]): Promise<SuggestionRow[]> {
    return this.db.client.investmentIncomeSuggestion.findMany({
      include: { event: true },
      orderBy: [{ event: { ex_date: 'desc' } }, { id: 'asc' }],
      where: { asset_id: { in: assetIds }, status: 'PENDING' },
    });
  }

  async findSuggestionById(id: string): Promise<null | SuggestionRow> {
    return this.db.client.investmentIncomeSuggestion.findUnique({
      include: { event: true },
      where: { id },
    });
  }

  async findSuggestionInputs(
    keys: { market: string; ticker: string }[],
  ): Promise<SuggestionInputsRow> {
    const assets = await this.db.client.investmentAsset.findMany({
      select: {
        asset_class: true,
        id: true,
        operations: {
          select: {
            created_at: true,
            date: true,
            id: true,
            quantity: true,
            total: true,
            type: true,
          },
        },
        ticker: true,
      },
      where: {
        asset_class: { in: ['BR_STOCK', 'BR_REIT', 'FOREIGN_STOCK'] },
        OR: keys.map((key) => ({ ticker: key.ticker })),
        status: 'ACTIVE',
      },
    });
    const wanted = new Set(keys.map((key) => `${key.market}:${key.ticker}`));
    const matched = assets.flatMap((asset) => {
      const market = asset.asset_class === 'FOREIGN_STOCK' ? 'US' : 'B3';

      return asset.ticker && wanted.has(`${market}:${asset.ticker}`)
        ? [{ asset_id: asset.id, market, operations: asset.operations, ticker: asset.ticker }]
        : [];
    });
    const ids = matched.map((asset) => asset.asset_id);
    const [existing, incomes] = await Promise.all([
      this.db.client.investmentIncomeSuggestion.findMany({
        select: { asset_id: true, event_id: true },
        where: { asset_id: { in: ids } },
      }),
      this.db.client.investmentIncome.findMany({
        select: { asset_id: true, ex_date: true, payment_date: true, type: true },
        where: { asset_id: { in: ids } },
      }),
    ]);

    return { assets: matched, existing, incomes };
  }

  async incomeTotals(assetId: string, yearFrom: Date, yearTo: Date) {
    const [received, planned] = await Promise.all([
      this.db.client.investmentIncome.aggregate({
        _sum: { net_amount: true },
        where: {
          asset_id: assetId,
          payment_date: { gte: yearFrom, lte: yearTo },
          transaction: { paid: true },
        },
      }),
      this.db.client.investmentIncome.aggregate({
        _sum: { net_amount: true },
        where: { asset_id: assetId, transaction: { paid: false } },
      }),
    ]);

    return {
      planned: planned._sum.net_amount ?? 0,
      received: received._sum.net_amount ?? 0,
    };
  }

  async rejectSuggestion(id: string, userId: string): Promise<void> {
    await this.db.client.investmentIncomeSuggestion.update({
      data: { decided_at: new Date(), decided_by: userId, status: 'REJECTED' },
      where: { id },
    });
  }

  // Holds a transaction-level advisory lock for the whole run: it is released when the transaction ends.
  async runExclusive(key: number, fn: () => Promise<void>): Promise<boolean> {
    return this.db.client.$transaction(
      async (tx) => {
        const [row] = await tx.$queryRaw<{ locked: boolean }[]>(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${key}) AS locked`,
        );

        if (!row?.locked) {
          return false;
        }

        await fn();

        return true;
      },
      { maxWait: 5000, timeout: 120_000 },
    );
  }

  async upsertEvents(rows: IncomeEventUpsert[]): Promise<InvestmentIncomeEvent[]> {
    const events: InvestmentIncomeEvent[] = [];

    for (const row of rows) {
      const data = {
        amount_per_unit: row.amountPerUnit,
        currency: row.currency,
        ex_date: InvestmentMapper.fromCalendarDate(row.exDate),
        fetched_at: row.fetchedAt,
        market: row.market,
        payment_date: row.paymentDate ? InvestmentMapper.fromCalendarDate(row.paymentDate) : null,
        source: row.source,
        ticker: row.ticker,
        type: row.type,
      };

      events.push(
        await this.db.client.investmentIncomeEvent.upsert({
          create: { ...data, event_key: row.eventKey },
          update: data,
          where: { event_key: row.eventKey },
        }),
      );
    }

    return events;
  }

  async writeIncome(params: WriteIncomeParams): Promise<string> {
    return this.db.client.$transaction(async (tx) => writeIncomeIn(tx, params));
  }
}

function toLinkedRow(
  row: { account_id: null | string; type: string; value: number } | null,
): LinkedRow | undefined {
  if (!row || !row.account_id) {
    return undefined;
  }

  return {
    accountId: row.account_id,
    type: row.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
    value: row.value,
  };
}
async function writeIncomeIn(
  tx: Prisma.TransactionClient,
  params: WriteIncomeParams,
): Promise<string> {
  await lockAsset(tx, params.assetId);

  const existing = params.incomeId
    ? await tx.investmentIncome.findUnique({
        include: { transaction: { select: LINKED_SELECT } },
        where: { id: params.incomeId },
      })
    : null;

  if (params.incomeId && !existing) {
    throw new NotFoundException('Income not found');
  }

  await lockAccounts(
    tx,
    [existing?.transaction?.account_id, params.accountId].filter((id): id is string => !!id),
  );

  const account = await tx.financialAccount.findUnique({
    select: { owner: true, owner_id: true },
    where: { id: params.accountId },
  });

  if (!account) {
    throw new NotFoundException('Account not found');
  }

  const row = {
    account_id: params.accountId,
    category_id: params.categoryId,
    currency: params.currency,
    date: InvestmentMapper.fromCalendarDate(params.paymentDate),
    description: params.assetLabel,
    external_lock: 'INVESTMENT',
    notes: params.notes,
    owner: account.owner,
    owner_id: account.owner_id,
    paid: params.paid,
    type: 'INCOME',
    value: params.netAmount,
  } as const;
  const fields = {
    amount_per_unit: params.amountPerUnit,
    ex_date: params.exDate ? InvestmentMapper.fromCalendarDate(params.exDate) : null,
    net_amount: params.netAmount,
    notes: params.notes,
    payment_date: InvestmentMapper.fromCalendarDate(params.paymentDate),
    quantity: params.quantity,
    type: params.type,
  };

  let transactionId = existing?.transaction_id ?? null;

  if (transactionId) {
    await tx.financialTransaction.update({ data: row, where: { id: transactionId } });
  } else {
    transactionId = (await tx.financialTransaction.create({ data: row })).id;
  }

  const income = existing
    ? await tx.investmentIncome.update({
        data: { ...fields, transaction_id: transactionId },
        where: { id: existing.id },
      })
    : await tx.investmentIncome.create({
        data: {
          ...fields,
          asset_id: params.assetId,
          created_by: params.createdBy,
          currency: params.currency,
          suggestion_id: params.suggestionId ?? null,
          transaction_id: transactionId,
        },
      });

  if (!existing && params.suggestionId) {
    await tx.investmentIncomeSuggestion.update({
      data: { decided_at: new Date(), decided_by: params.createdBy, status: 'APPROVED' },
      where: { id: params.suggestionId },
    });
  }

  // Only a received row moves the ledger (spec 033): the reversal of the old one, then the new one.
  const before = existing?.transaction?.paid ? toLinkedRow(existing.transaction) : undefined;
  const after = params.paid
    ? { accountId: params.accountId, type: 'INCOME' as const, value: params.netAmount }
    : undefined;

  await applyDeltas(tx, ledgerDeltasFor(before, after));

  return income.id;
}
