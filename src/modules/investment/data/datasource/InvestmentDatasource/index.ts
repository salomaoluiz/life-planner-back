import { Injectable, NotFoundException } from '@nestjs/common';

import {
  FinancialAccount,
  InvestmentAsset,
  InvestmentAssetStatus,
  InvestmentFixedIncomeAdjustment,
  InvestmentFixedIncomeRate,
  InvestmentOperation,
  InvestmentValuation,
  OwnerType,
  Prisma,
} from '@db/client';
import {
  assertPositionValid,
  recomputeEventSuggestions,
} from '@investment/data/datasource/corporateEvent';
import {
  applyDeltas,
  ledgerDeltasFor,
  LinkedRow,
  lockAccounts,
  lockAsset,
  reversalDeltas,
} from '@investment/data/datasource/financeLink';
import {
  convertManualOperations,
  deleteAdjustment,
  deleteRate,
  insertRate,
  recalculateFixedIncome,
  replaceRate,
  saveAdjustment,
  saveTerms,
} from '@investment/data/datasource/fixedIncome';
import { recomputeSuggestions } from '@investment/data/datasource/income';
import { toOwnerWhere } from '@investment/data/datasource/mapper/OwnerWhere';
import {
  CreateAssetDatasourceParams,
  CreateFixedIncomeTitleDatasourceParams,
  FixedIncomeRows,
  IInvestmentDatasource,
  OperationRow,
  SaveFixedIncomeTermsDatasourceParams,
  UpdateAssetDatasourceParams,
  WriteEventDatasourceParams,
  WriteOperationDatasourceParams,
} from '@investment/data/repository/datasource/IInvestmentDatasource';
import { FixedIncomeRateWrite } from '@investment/domain/entity/FixedIncomeEntity';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { categoryIdOf } from '@investment/domain/entity/SystemCategories';
import { InvestmentOperationType } from '@investment/domain/enum';
import { Database } from '@shared/infra/db/Database';

const OPERATION_ORDER = [{ date: 'desc' }, { created_at: 'desc' }, { id: 'desc' }] as const;
const LINKED_SELECT = { account_id: true, paid: true, type: true, value: true } as const;

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

  async createFixedIncomeRate(assetId: string, rate: FixedIncomeRateWrite): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockAsset(tx, assetId);
      await insertRate(tx, assetId, rate);
      await recalculateFixedIncome(tx, assetId);
    });
  }

  async createFixedIncomeTitle(
    params: CreateFixedIncomeTitleDatasourceParams,
  ): Promise<{ assetId: string; operationId: string }> {
    return this.db.client.$transaction(async (tx) => {
      const created = await tx.investmentAsset.create({
        data: {
          asset_class: params.asset.asset_class,
          currency: params.asset.currency,
          name: params.asset.name,
          owner: params.asset.owner,
          owner_id: params.asset.owner_id,
          ticker: params.asset.ticker,
        },
      });

      await saveTerms(tx, created.id, params.terms);
      await insertRate(tx, created.id, params.rate);

      const operationId = await writeOperationIn(tx, {
        ...params.contribution,
        asset_id: created.id,
      });

      return { assetId: created.id, operationId };
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

  async deleteFixedIncomeAdjustment(assetId: string, id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockAsset(tx, assetId);
      await deleteAdjustment(tx, id);
      await recalculateFixedIncome(tx, assetId);
    });
  }

  async deleteFixedIncomeRate(assetId: string, id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockAsset(tx, assetId);
      await deleteRate(tx, id);
      await recalculateFixedIncome(tx, assetId);
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

      // Spec 108 FR 21: an event takes its fraction sale (and that sale's finance row) with it.
      const sale = await tx.investmentOperation.findUnique({
        include: { transaction: { select: LINKED_SELECT } },
        where: { fraction_of_operation_id: id },
      });
      const removed = sale ? [existing, sale] : [existing];

      await lockAccounts(
        tx,
        removed
          .map((operation) => operation.transaction?.account_id)
          .filter((accountId): accountId is string => !!accountId),
      );

      if (existing.event_suggestion_id) {
        await tx.investmentEventSuggestion.update({
          data: { status: 'DISMISSED' },
          where: { id: existing.event_suggestion_id },
        });
      }

      for (const operation of removed.reverse()) {
        await tx.investmentOperation.delete({ where: { id: operation.id } });

        if (operation.transaction_id) {
          await tx.financialTransaction.delete({ where: { id: operation.transaction_id } });
        }

        await applyDeltas(tx, ledgerDeltasFor(toLinkedRow(operation.transaction), undefined));
      }

      await recalculateFixedIncome(tx, existing.asset_id);
      await assertPositionValid(tx, existing.asset_id);
      await recomputeSuggestions(tx, existing.asset_id);
      await recomputeEventSuggestions(tx, existing.asset_id);
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

  async findFixedIncomeAdjustmentById(id: string): Promise<InvestmentFixedIncomeAdjustment | null> {
    return this.db.client.investmentFixedIncomeAdjustment.findUnique({ where: { id } });
  }

  async findFixedIncomeByAssetIds(assetIds: string[]): Promise<FixedIncomeRows> {
    const where = { asset_id: { in: assetIds } };
    const terms = await this.db.client.investmentFixedIncomeTerms.findMany({ where });
    const rates = await this.db.client.investmentFixedIncomeRate.findMany({
      orderBy: [{ start_date: 'asc' }],
      where,
    });
    const adjustments = await this.db.client.investmentFixedIncomeAdjustment.findMany({
      orderBy: [{ date: 'asc' }],
      where,
    });

    return { adjustments, rates, terms };
  }

  async findFixedIncomeRateById(id: string): Promise<InvestmentFixedIncomeRate | null> {
    return this.db.client.investmentFixedIncomeRate.findUnique({ where: { id } });
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

  async saveFixedIncomeTerms(params: SaveFixedIncomeTermsDatasourceParams): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockAsset(tx, params.assetId);

      if (params.convert) {
        await convertManualOperations(tx, params.assetId);
      }

      await saveTerms(tx, params.assetId, params.terms);

      if (params.rate) {
        await insertRate(tx, params.assetId, params.rate);
      }

      await recalculateFixedIncome(tx, params.assetId);
    });
  }

  async updateAsset(params: UpdateAssetDatasourceParams): Promise<InvestmentAsset> {
    const { id, ...data } = params;

    return this.db.client.investmentAsset.update({ data, where: { id } });
  }

  async updateFixedIncomeRate(
    assetId: string,
    id: string,
    rate: FixedIncomeRateWrite,
  ): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockAsset(tx, assetId);
      await replaceRate(tx, id, rate);
      await recalculateFixedIncome(tx, assetId);
    });
  }

  async upsertFixedIncomeAdjustment(
    assetId: string,
    date: string,
    grossAmount: number,
  ): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockAsset(tx, assetId);
      await saveAdjustment(tx, assetId, date, grossAmount);
      await recalculateFixedIncome(tx, assetId);
    });
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

  async writeEvent(params: WriteEventDatasourceParams): Promise<string> {
    return this.db.client.$transaction(async (tx) => {
      await lockAsset(tx, params.asset_id);

      const fields = {
        bonus_percent: params.bonus_percent,
        bonus_unit_cost: params.bonus_unit_cost,
        date: params.date,
        ratio_from: params.ratio_from,
        ratio_to: params.ratio_to,
      };
      let operationId: string;

      if (params.operation_id) {
        const existing = await tx.investmentOperation.findUnique({
          select: { id: true },
          where: { id: params.operation_id },
        });

        if (!existing) {
          throw new NotFoundException('Operation not found');
        }

        operationId = (
          await tx.investmentOperation.update({ data: fields, where: { id: existing.id } })
        ).id;
      } else {
        operationId = (
          await tx.investmentOperation.create({
            data: {
              ...fields,
              asset_id: params.asset_id,
              event_suggestion_id: params.event_suggestion_id ?? null,
              generate_transaction: false,
              type: params.type,
            },
          })
        ).id;
      }

      if (params.event_suggestion_id) {
        await tx.investmentEventSuggestion.update({
          data: {
            decided_at: new Date(),
            decided_by: params.decided_by ?? null,
            status: 'APPROVED',
          },
          where: { id: params.event_suggestion_id },
        });
      }

      await assertPositionValid(tx, params.asset_id);
      await recomputeSuggestions(tx, params.asset_id);
      await recomputeEventSuggestions(tx, params.asset_id);

      return operationId;
    });
  }

  async writeOperation(params: WriteOperationDatasourceParams): Promise<string> {
    return this.db.client.$transaction(async (tx) => writeOperationIn(tx, params));
  }
}

async function writeOperationIn(
  tx: Prisma.TransactionClient,
  params: WriteOperationDatasourceParams,
): Promise<string> {
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
    fx_rate: params.fx_rate,
    generate_transaction: params.generate_transaction,
    gross: params.gross,
    net_amount: params.net_amount ?? null,
    quantity: params.quantity,
    redemption_kind: params.redemption_kind ?? null,
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
          fraction_of_operation_id: params.fraction_of_operation_id ?? null,
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
  await recalculateFixedIncome(tx, params.asset_id);
  await assertPositionValid(tx, params.asset_id);
  await recomputeSuggestions(tx, params.asset_id);
  await recomputeEventSuggestions(tx, params.asset_id);

  return operation.id;
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
  // Spec 107 FR 22: the finance rows of the incomes go too; only the received ones moved the ledger.
  const incomes = await tx.investmentIncome.findMany({
    select: { transaction: { select: LINKED_SELECT }, transaction_id: true },
    where: { asset_id: { in: assetIds }, transaction_id: { not: null } },
  });
  const rows = [
    ...operations.map((operation) => toLinkedRow(operation.transaction)),
    ...incomes.map((income) =>
      income.transaction?.paid ? toLinkedRow(income.transaction) : undefined,
    ),
  ].filter((row): row is LinkedRow => row !== undefined);
  const transactionIds = [...operations, ...incomes]
    .map((item) => item.transaction_id)
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
