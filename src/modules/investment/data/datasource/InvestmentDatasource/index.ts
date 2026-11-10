import { Injectable, NotFoundException } from '@nestjs/common';

import {
  FinancialAccount,
  InvestmentAsset,
  InvestmentAssetStatus,
  InvestmentOperation,
  InvestmentValuation,
  OwnerType,
  Prisma,
} from '@db/client';
import {
  applyDeltas,
  ledgerDeltasFor,
  LinkedRow,
  lockAccounts,
  lockAsset,
  reversalDeltas,
} from '@investment/data/datasource/financeLink';
import { toOwnerWhere } from '@investment/data/datasource/mapper/OwnerWhere';
import {
  CreateAssetDatasourceParams,
  IInvestmentDatasource,
  OperationRow,
  UpdateAssetDatasourceParams,
  WriteOperationDatasourceParams,
} from '@investment/data/repository/datasource/IInvestmentDatasource';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { categoryIdOf } from '@investment/domain/entity/SystemCategories';
import { InvestmentOperationType } from '@investment/domain/enum';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { calculatePosition } from '@investment/domain/service/PositionCalculator';
import { Database } from '@shared/infra/db/Database';
import { Decimal8 } from '@shared/infra/decimal';

const OPERATION_ORDER = [{ date: 'desc' }, { created_at: 'desc' }, { id: 'desc' }] as const;
const LINKED_SELECT = { account_id: true, type: true, value: true } as const;

@Injectable()
export class InvestmentDatasource implements IInvestmentDatasource {
  constructor(private readonly db: Database) {}

  async createAsset(params: CreateAssetDatasourceParams): Promise<InvestmentAsset> {
    const { valuation, ...data } = params;

    return this.db.client.investmentAsset.create({
      data: {
        ...data,
        ...(valuation
          ? { valuations: { create: { date: valuation.date, unit_price: valuation.unit_price } } }
          : {}),
      },
    });
  }

  async deleteAsset(id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await removeAssets(tx, [id]);
    });
  }

  async deleteAssetsByOwner(owner: OwnerType, ownerId: string): Promise<number> {
    return this.db.client.$transaction(async (tx) => {
      const assets = await tx.investmentAsset.findMany({
        select: { id: true },
        where: { owner, owner_id: ownerId },
      });

      await removeAssets(
        tx,
        assets.map((asset) => asset.id),
      );

      return assets.length;
    });
  }

  async deleteOperation(id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const existing = await tx.investmentOperation.findUnique({
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
      await tx.investmentOperation.delete({ where: { id } });

      if (existing.transaction_id) {
        await tx.financialTransaction.delete({ where: { id: existing.transaction_id } });
      }

      await applyDeltas(tx, ledgerDeltasFor(toLinkedRow(existing.transaction), undefined));
      await assertPositionNotNegative(tx, existing.asset_id);
    });
  }

  async deleteValuation(id: string): Promise<void> {
    await this.db.client.investmentValuation.deleteMany({ where: { id } });
  }

  async existsByOwner(owner: OwnerType, ownerId: string): Promise<boolean> {
    const found = await this.db.client.investmentAsset.findFirst({
      select: { id: true },
      where: { owner, owner_id: ownerId },
    });

    return found !== null;
  }

  async findAccountById(
    id: string,
  ): Promise<null | Pick<FinancialAccount, 'currency' | 'id' | 'owner_id' | 'owner' | 'status'>> {
    return this.db.client.financialAccount.findUnique({
      select: { currency: true, id: true, owner: true, owner_id: true, status: true },
      where: { id },
    });
  }

  async findAssetById(id: string): Promise<InvestmentAsset | null> {
    return this.db.client.investmentAsset.findUnique({ where: { id } });
  }

  async findAssetByTicker(
    owner: OwnerType,
    ownerId: string,
    ticker: string,
  ): Promise<InvestmentAsset | null> {
    return this.db.client.investmentAsset.findFirst({
      where: { owner, owner_id: ownerId, ticker },
    });
  }

  async findAssets(
    owners: OwnerAccess[],
    status: InvestmentAssetStatus,
  ): Promise<InvestmentAsset[]> {
    return this.db.client.investmentAsset.findMany({
      orderBy: [{ asset_class: 'asc' }, { ticker: 'asc' }, { name: 'asc' }],
      where: { ...toOwnerWhere(owners), status },
    });
  }

  async findLatestValuations(assetIds: string[]): Promise<InvestmentValuation[]> {
    return this.db.client.investmentValuation.findMany({
      distinct: ['asset_id'],
      orderBy: [{ asset_id: 'asc' }, { date: 'desc' }],
      where: { asset_id: { in: assetIds } },
    });
  }

  async findOperationById(id: string): Promise<null | OperationRow> {
    return this.db.client.investmentOperation.findUnique({
      include: { fees: true },
      where: { id },
    });
  }

  async findOperationByTransactionId(
    transactionId: string,
  ): Promise<null | Pick<InvestmentOperation, 'asset_id' | 'id'>> {
    return this.db.client.investmentOperation.findUnique({
      select: { asset_id: true, id: true },
      where: { transaction_id: transactionId },
    });
  }

  async findOperationsByAssetIds(assetIds: string[]): Promise<OperationRow[]> {
    return this.db.client.investmentOperation.findMany({
      include: { fees: true },
      orderBy: [...OPERATION_ORDER],
      where: { asset_id: { in: assetIds } },
    });
  }

  async findValuationById(id: string): Promise<InvestmentValuation | null> {
    return this.db.client.investmentValuation.findUnique({ where: { id } });
  }

  async findValuationsByAssetId(assetId: string): Promise<InvestmentValuation[]> {
    return this.db.client.investmentValuation.findMany({
      orderBy: [{ date: 'desc' }],
      where: { asset_id: assetId },
    });
  }

  async updateAsset(params: UpdateAssetDatasourceParams): Promise<InvestmentAsset> {
    const { id, ...data } = params;

    return this.db.client.investmentAsset.update({ data, where: { id } });
  }

  async upsertValuation(
    assetId: string,
    date: Date,
    unitPrice: string,
  ): Promise<InvestmentValuation> {
    return this.db.client.investmentValuation.upsert({
      create: { asset_id: assetId, date, unit_price: unitPrice },
      update: { unit_price: unitPrice },
      where: { asset_id_date: { asset_id: assetId, date } },
    });
  }

  async writeOperation(params: WriteOperationDatasourceParams): Promise<string> {
    return this.db.client.$transaction(async (tx) => {
      await lockAsset(tx, params.asset_id);

      const existing = params.operation_id
        ? await tx.investmentOperation.findUnique({
            include: { transaction: { select: LINKED_SELECT } },
            where: { id: params.operation_id },
          })
        : null;

      if (params.operation_id && !existing) {
        throw new NotFoundException('Operation not found');
      }

      await lockAccounts(
        tx,
        [existing?.account_id, params.account_id].filter((id): id is string => !!id),
      );

      const fields = {
        account_id: params.generate_transaction ? params.account_id : null,
        date: params.date,
        fees_total: params.fees_total,
        generate_transaction: params.generate_transaction,
        gross: params.gross,
        quantity: params.quantity,
        total: params.total,
        unit_price: params.unit_price,
      };
      const fees = params.fees.map((fee) => ({
        amount: fee.amount,
        description: fee.description,
        kind: fee.kind,
      }));
      const operation = existing
        ? await tx.investmentOperation.update({
            data: { ...fields, fees: { create: fees, deleteMany: {} } },
            where: { id: existing.id },
          })
        : await tx.investmentOperation.create({
            data: {
              ...fields,
              asset_id: params.asset_id,
              fees: { create: fees },
              type: params.type,
            },
          });

      const before = toLinkedRow(existing?.transaction ?? null);
      let transactionId = existing?.transaction_id ?? null;
      let after: LinkedRow | undefined;

      if (params.generate_transaction && params.account_id) {
        const account = await tx.financialAccount.findUnique({
          select: { owner: true, owner_id: true },
          where: { id: params.account_id },
        });

        if (!account) {
          throw new NotFoundException('Account not found');
        }

        const operationType = params.type as InvestmentOperationType;
        const type = operationType === InvestmentOperationType.BUY ? 'EXPENSE' : 'INCOME';
        const row = {
          account_id: params.account_id,
          category_id: categoryIdOf(operationType),
          currency: params.currency,
          date: params.date,
          description: params.asset_label,
          owner: account.owner,
          owner_id: account.owner_id,
          paid: true,
          type,
          value: params.total,
        } as const;

        if (transactionId) {
          await tx.financialTransaction.update({ data: row, where: { id: transactionId } });
        } else {
          transactionId = (await tx.financialTransaction.create({ data: row })).id;
        }

        after = { accountId: params.account_id, type, value: params.total };
      } else if (transactionId) {
        await tx.financialTransaction.delete({ where: { id: transactionId } });
        transactionId = null;
      }

      if (transactionId !== operation.transaction_id) {
        await tx.investmentOperation.update({
          data: { transaction_id: transactionId },
          where: { id: operation.id },
        });
      }

      await applyDeltas(tx, ledgerDeltasFor(before, after));
      await assertPositionNotNegative(tx, params.asset_id);

      return operation.id;
    });
  }
}

async function assertPositionNotNegative(
  tx: Prisma.TransactionClient,
  assetId: string,
): Promise<void> {
  const rows = await tx.investmentOperation.findMany({
    select: { created_at: true, date: true, id: true, quantity: true, total: true, type: true },
    where: { asset_id: assetId },
  });
  const position = calculatePosition(
    rows.map((row) => ({
      createdAt: row.created_at,
      date: row.date.toISOString().slice(0, 10),
      id: row.id,
      quantity: Decimal8.parse(row.quantity.toFixed(8)),
      total: row.total,
      type: row.type as InvestmentOperationType,
    })),
  );

  if (position.negativeAt) {
    throw new NegativePositionError(position.negativeAt.date, position.negativeAt.operationId);
  }
}

// Asset delete / owner purge: the linked rows go with the assets and the accounts get their balance back.
async function removeAssets(tx: Prisma.TransactionClient, assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) {
    return;
  }

  for (const id of [...assetIds].sort()) {
    await lockAsset(tx, id);
  }

  const operations = await tx.investmentOperation.findMany({
    select: { transaction: { select: LINKED_SELECT }, transaction_id: true },
    where: { asset_id: { in: assetIds }, transaction_id: { not: null } },
  });
  const rows = operations
    .map((operation) => toLinkedRow(operation.transaction))
    .filter((row): row is LinkedRow => row !== undefined);
  const transactionIds = operations
    .map((operation) => operation.transaction_id)
    .filter((id): id is string => id !== null);

  await lockAccounts(
    tx,
    rows.map((row) => row.accountId),
  );

  if (transactionIds.length > 0) {
    await tx.financialTransaction.deleteMany({ where: { id: { in: transactionIds } } });
  }

  await applyDeltas(tx, reversalDeltas(rows));
  await tx.investmentAsset.deleteMany({ where: { id: { in: assetIds } } });
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
