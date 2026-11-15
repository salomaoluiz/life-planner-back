import { Inject, Injectable } from '@nestjs/common';

import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import {
  IInvestmentDatasource,
  WriteOperationDatasourceParams,
} from '@investment/data/repository/datasource/IInvestmentDatasource';
import { AssetDetail, AssetEntity, AssetListRow } from '@investment/domain/entity/AssetEntity';
import {
  FixedIncomeAdjustmentEntity,
  FixedIncomeData,
  FixedIncomeRateEntity,
  FixedIncomeRateWrite,
} from '@investment/domain/entity/FixedIncomeEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import { InvestmentAssetStatus } from '@investment/domain/enum';
import {
  CreateAssetRepositoryParams,
  CreateFixedIncomeTitleRepositoryParams,
  IInvestmentRepository,
  OperationAccount,
  SaveFixedIncomeTermsRepositoryParams,
  UpdateAssetRepositoryParams,
  UpsertValuationRepositoryParams,
  WriteEventRepositoryParams,
  WriteOperationRepositoryParams,
} from '@investment/domain/repository';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

@Injectable()
export class InvestmentRepository implements IInvestmentRepository {
  constructor(
    @Inject('IInvestmentDatasource')
    private readonly datasource: IInvestmentDatasource,
  ) {}

  async createAsset(params: CreateAssetRepositoryParams): Promise<AssetEntity> {
    const row = await this.datasource.createAsset({
      asset_class: params.assetClass,
      currency: params.currency,
      name: params.name,
      owner: params.owner,
      owner_id: params.ownerId,
      ticker: params.ticker,
      valuation: params.initialValuation
        ? {
            date: InvestmentMapper.fromCalendarDate(params.initialValuation.date),
            unit_price: params.initialValuation.unitPrice.toFixed8(),
          }
        : undefined,
    });

    return InvestmentMapper.toAsset(row);
  }

  async createFixedIncomeRate(assetId: string, rate: FixedIncomeRateWrite): Promise<void> {
    await this.datasource.createFixedIncomeRate(assetId, rate);
  }

  async createFixedIncomeTitle(
    params: CreateFixedIncomeTitleRepositoryParams,
  ): Promise<{ assetId: string; operationId: string }> {
    return this.datasource.createFixedIncomeTitle({
      asset: {
        asset_class: params.asset.assetClass,
        currency: params.asset.currency,
        name: params.asset.name,
        owner: params.asset.owner,
        owner_id: params.asset.ownerId,
        ticker: params.asset.ticker,
      },
      contribution: toWriteParams(params.contribution),
      rate: params.rate,
      terms: params.terms,
    });
  }

  async deleteAsset(id: string): Promise<void> {
    await this.datasource.deleteAsset(id);
  }

  async deleteAssetsByOwner(access: Pick<OwnerAccess, 'owner' | 'ownerId'>): Promise<number> {
    return this.datasource.deleteAssetsByOwner(access.owner, access.ownerId);
  }

  async deleteFixedIncomeAdjustment(assetId: string, id: string): Promise<void> {
    await this.datasource.deleteFixedIncomeAdjustment(assetId, id);
  }

  async deleteFixedIncomeRate(assetId: string, id: string): Promise<void> {
    await this.datasource.deleteFixedIncomeRate(assetId, id);
  }

  async deleteOperation(id: string): Promise<void> {
    await this.datasource.deleteOperation(id);
  }

  async deleteValuation(id: string): Promise<void> {
    await this.datasource.deleteValuation(id);
  }

  async existsByOwner(access: Pick<OwnerAccess, 'owner' | 'ownerId'>): Promise<boolean> {
    return this.datasource.existsByOwner(access.owner, access.ownerId);
  }

  async findAccountForOperation(id: string): Promise<OperationAccount | undefined> {
    const row = await this.datasource.findAccountById(id);

    return row
      ? {
          archived: row.status === 'ARCHIVED',
          currency: row.currency,
          id: row.id,
          owner: OwnerType[row.owner],
          ownerId: row.owner_id,
        }
      : undefined;
  }

  async findAssetById(id: string): Promise<AssetDetail | undefined> {
    const asset = await this.datasource.findAssetById(id);

    if (!asset) {
      return undefined;
    }

    const [operations, valuations] = await Promise.all([
      this.datasource.findOperationsByAssetIds([id]),
      this.datasource.findValuationsByAssetId(id),
    ]);

    return {
      ...InvestmentMapper.toAsset(asset),
      operations: operations.map((row) => InvestmentMapper.toOperation(row)),
      valuations: valuations.map((row) => InvestmentMapper.toValuation(row)),
    };
  }

  async findAssetByTicker(
    owner: OwnerType,
    ownerId: string,
    ticker: string,
  ): Promise<AssetEntity | undefined> {
    const row = await this.datasource.findAssetByTicker(owner, ownerId, ticker);

    return row ? InvestmentMapper.toAsset(row) : undefined;
  }

  async findAssetsByOwners(
    owners: OwnerAccess[],
    status: InvestmentAssetStatus,
  ): Promise<AssetListRow[]> {
    if (owners.length === 0) {
      return [];
    }

    const assets = await this.datasource.findAssets(owners, status);

    if (assets.length === 0) {
      return [];
    }

    const ids = assets.map((asset) => asset.id);
    const [operations, valuations] = await Promise.all([
      this.datasource.findOperationsByAssetIds(ids),
      this.datasource.findLatestValuations(ids),
    ]);

    return assets.map((asset) => ({
      ...InvestmentMapper.toAsset(asset),
      latestValuation: toLatest(valuations.find((row) => row.asset_id === asset.id)),
      operations: operations
        .filter((row) => row.asset_id === asset.id)
        .map((row) => InvestmentMapper.toOperation(row)),
    }));
  }

  async findFixedIncomeAdjustmentById(
    id: string,
  ): Promise<FixedIncomeAdjustmentEntity | undefined> {
    const row = await this.datasource.findFixedIncomeAdjustmentById(id);

    return row ? InvestmentMapper.toAdjustment(row) : undefined;
  }

  async findFixedIncomeByAssetIds(assetIds: string[]): Promise<Map<string, FixedIncomeData>> {
    const result = new Map<string, FixedIncomeData>();

    if (assetIds.length === 0) {
      return result;
    }

    const rows = await this.datasource.findFixedIncomeByAssetIds(assetIds);

    for (const terms of rows.terms) {
      result.set(terms.asset_id, {
        adjustments: rows.adjustments
          .filter((row) => row.asset_id === terms.asset_id)
          .map((row) => InvestmentMapper.toAdjustment(row)),
        rates: rows.rates
          .filter((row) => row.asset_id === terms.asset_id)
          .map((row) => InvestmentMapper.toRate(row)),
        terms: InvestmentMapper.toTerms(terms),
      });
    }

    return result;
  }

  async findFixedIncomeRateById(id: string): Promise<FixedIncomeRateEntity | undefined> {
    const row = await this.datasource.findFixedIncomeRateById(id);

    return row ? InvestmentMapper.toRate(row) : undefined;
  }

  async findOperationById(id: string): Promise<OperationEntity | undefined> {
    const row = await this.datasource.findOperationById(id);

    return row ? InvestmentMapper.toOperation(row) : undefined;
  }

  async findOperationByTransactionId(
    transactionId: string,
  ): Promise<{ assetId: string; operationId: string } | undefined> {
    const row = await this.datasource.findOperationByTransactionId(transactionId);

    return row ? { assetId: row.asset_id, operationId: row.id } : undefined;
  }

  async findValuationById(id: string): Promise<undefined | ValuationEntity> {
    const row = await this.datasource.findValuationById(id);

    return row ? InvestmentMapper.toValuation(row) : undefined;
  }

  async saveFixedIncomeTerms(params: SaveFixedIncomeTermsRepositoryParams): Promise<void> {
    await this.datasource.saveFixedIncomeTerms(params);
  }

  async updateAsset(params: UpdateAssetRepositoryParams): Promise<AssetEntity> {
    const row = await this.datasource.updateAsset({
      archived_at: params.archivedAt,
      asset_class: params.assetClass,
      currency: params.currency,
      id: params.id,
      name: params.name,
      owner: params.owner,
      owner_id: params.ownerId,
      status: params.status,
      ticker: params.ticker,
    });

    return InvestmentMapper.toAsset(row);
  }

  async updateFixedIncomeRate(
    assetId: string,
    id: string,
    rate: FixedIncomeRateWrite,
  ): Promise<void> {
    await this.datasource.updateFixedIncomeRate(assetId, id, rate);
  }

  async upsertFixedIncomeAdjustment(
    assetId: string,
    date: string,
    grossAmount: number,
  ): Promise<void> {
    await this.datasource.upsertFixedIncomeAdjustment(assetId, date, grossAmount);
  }

  async upsertValuation(params: UpsertValuationRepositoryParams): Promise<ValuationEntity> {
    const row = await this.datasource.upsertValuation(
      params.assetId,
      InvestmentMapper.fromCalendarDate(params.date),
      params.unitPrice.toFixed8(),
    );

    return InvestmentMapper.toValuation(row);
  }

  async writeEvent(params: WriteEventRepositoryParams): Promise<string> {
    return this.datasource.writeEvent({
      asset_id: params.assetId,
      bonus_percent: params.bonusPercent?.toFixed8() ?? null,
      bonus_unit_cost: params.bonusUnitCost?.toFixed8() ?? null,
      date: InvestmentMapper.fromCalendarDate(params.date),
      decided_by: params.decidedBy,
      event_suggestion_id: params.eventSuggestionId,
      operation_id: params.operationId,
      ratio_from: params.ratioFrom?.toFixed8() ?? null,
      ratio_to: params.ratioTo?.toFixed8() ?? null,
      type: params.type,
    });
  }

  async writeOperation(params: WriteOperationRepositoryParams): Promise<string> {
    return this.datasource.writeOperation(toWriteParams(params));
  }
}

function toLatest(
  row: Parameters<typeof InvestmentMapper.toValuation>[0] | undefined,
): null | ValuationEntity {
  return row ? InvestmentMapper.toValuation(row) : null;
}
function toWriteParams(
  params: { assetId?: string } & Omit<WriteOperationRepositoryParams, 'assetId'>,
): WriteOperationDatasourceParams {
  return {
    account_id: params.accountId,
    asset_id: params.assetId ?? '',
    asset_label: params.assetLabel,
    currency: params.currency,
    date: InvestmentMapper.fromCalendarDate(params.date),
    fees: params.fees,
    fees_total: params.feesTotal,
    fraction_of_operation_id: params.fractionOfOperationId,
    fx_rate: params.fxRate,
    generate_transaction: params.generateTransaction,
    gross: params.gross,
    net_amount: params.netAmount,
    operation_id: params.operationId,
    quantity: params.quantity.toFixed8(),
    redemption_kind: params.redemptionKind,
    total: params.total,
    type: params.type,
    unit_price: params.unitPrice.toFixed8(),
  };
}
