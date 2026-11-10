import { Injectable } from '@nestjs/common';

import {
  AssetItemOutputType,
  CreateAssetApiInput,
  CreateOperationApiInput,
  OperationOutputType,
  PositionOutputType,
  UpdateAssetApiInput,
  UpdateOperationApiInput,
  UpsertValuationApiInput,
  ValuationOutputType,
} from '@api/investment/v1/dto/investment.dto';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import {
  AssetDetailView,
  AssetView,
  OperationView,
} from '@investment/application/service/AssetView';
import { OperationWriteResult } from '@investment/application/service/OperationRules';
import { CreateAssetUseCase } from '@investment/application/use-case/CreateAssetUseCase';
import { CreateOperationUseCase } from '@investment/application/use-case/CreateOperationUseCase';
import { DeleteAssetUseCase } from '@investment/application/use-case/DeleteAssetUseCase';
import { DeleteOperationUseCase } from '@investment/application/use-case/DeleteOperationUseCase';
import { DeleteValuationUseCase } from '@investment/application/use-case/DeleteValuationUseCase';
import { GetAssetByIdUseCase } from '@investment/application/use-case/GetAssetByIdUseCase';
import { GetAssetsUseCase } from '@investment/application/use-case/GetAssetsUseCase';
import { UpdateAssetUseCase } from '@investment/application/use-case/UpdateAssetUseCase';
import { UpdateOperationUseCase } from '@investment/application/use-case/UpdateOperationUseCase';
import { UpsertValuationUseCase } from '@investment/application/use-case/UpsertValuationUseCase';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import { InvestmentAssetStatus } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export function toAssetItem(view: AssetView): AssetItemOutputType {
  const { asset, operationCount, position } = view;

  return {
    archivedAt: asset.archivedAt?.toISOString() ?? null,
    assetClass: asset.assetClass,
    currency: asset.currency,
    id: asset.id,
    name: asset.name,
    operationCount,
    owner: asset.owner,
    ownerId: asset.ownerId,
    position: toPosition(position),
    status: asset.status,
    ticker: asset.ticker,
  };
}
export function toOperation(view: OperationView): OperationOutputType {
  const { operation } = view;

  return {
    accountId: operation.accountId,
    costRemoved: view.costRemoved,
    date: operation.date,
    fees: operation.fees.map((fee) => ({
      amount: fee.amount,
      description: fee.description,
      id: fee.id,
      kind: fee.kind,
    })),
    feesTotal: operation.feesTotal,
    fxRate: operation.fxRate,
    generateTransaction: operation.generateTransaction,
    gross: operation.gross,
    id: operation.id,
    quantity: operation.quantity.toString(),
    realizedResult: view.realizedResult,
    total: operation.total,
    transactionId: operation.transactionId,
    type: operation.type,
    unitPrice: operation.unitPrice.toString(),
  };
}
export function toPosition(position: AssetView['position']): PositionOutputType {
  return {
    averagePrice: position.averagePrice,
    cost: position.cost,
    currentUnitPrice: position.currentUnitPrice?.toString() ?? null,
    currentValue: position.currentValue,
    currentValueDate: position.currentValueDate,
    openResult: position.openResult,
    openResultPercent: position.openResultPercent,
    quantity: position.quantity.toString(),
    realizedResult: position.realizedResult,
  };
}
export function toValuation(valuation: ValuationEntity): ValuationOutputType {
  return {
    date: valuation.date,
    id: valuation.id,
    source: valuation.source,
    unitPrice: valuation.unitPrice.toString(),
  };
}

function toAssetDetail(view: AssetDetailView) {
  return {
    item: {
      ...toAssetItem(view),
      operations: view.operations.map((operation) => toOperation(operation)),
      valuations: view.valuations.map((valuation) => toValuation(valuation)),
    },
  };
}
function toOperationWrite(result: OperationWriteResult) {
  return { item: toOperation(result.operation), position: toPosition(result.asset.position) };
}

@Injectable()
export class InvestmentService {
  constructor(
    private readonly createAssetUseCase: CreateAssetUseCase,
    private readonly createOperationUseCase: CreateOperationUseCase,
    private readonly deleteAssetUseCase: DeleteAssetUseCase,
    private readonly deleteOperationUseCase: DeleteOperationUseCase,
    private readonly deleteValuationUseCase: DeleteValuationUseCase,
    private readonly getAssetByIdUseCase: GetAssetByIdUseCase,
    private readonly getAssetsUseCase: GetAssetsUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly updateAssetUseCase: UpdateAssetUseCase,
    private readonly updateOperationUseCase: UpdateOperationUseCase,
    private readonly upsertValuationUseCase: UpsertValuationUseCase,
  ) {}

  async createAsset(userId: string, input: CreateAssetApiInput): Promise<AssetItemOutputType> {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    return toAssetItem(await this.createAssetUseCase.execute({ ...input, accessibleOwners }));
  }

  async createOperation(
    userId: string,
    assetId: string,
    input: CreateOperationApiInput,
  ): Promise<ReturnType<typeof toOperationWrite>> {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    return toOperationWrite(
      await this.createOperationUseCase.execute({ ...input, accessibleOwners, assetId }),
    );
  }

  async deleteAsset(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    await this.deleteAssetUseCase.execute({ accessibleOwners, id });
  }

  async deleteOperation(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    await this.deleteOperationUseCase.execute({ accessibleOwners, id });
  }

  async deleteValuation(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    await this.deleteValuationUseCase.execute({ accessibleOwners, id });
  }

  async findAssetById(userId: string, id: string) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const view = await this.getAssetByIdUseCase.execute({ accessibleOwners, id });
    return toAssetDetail(view);
  }

  async findAssets(
    userId: string,
    query: { ownerId?: string; status?: InvestmentAssetStatus },
  ): Promise<{ items: AssetItemOutputType[] }> {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const views = await this.getAssetsUseCase.execute({ accessibleOwners, ...query });
    return { items: views.map((view) => toAssetItem(view)) };
  }

  async updateAsset(
    userId: string,
    id: string,
    input: UpdateAssetApiInput,
  ): Promise<AssetItemOutputType> {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    return toAssetItem(await this.updateAssetUseCase.execute({ ...input, accessibleOwners, id }));
  }

  async updateOperation(userId: string, id: string, input: UpdateOperationApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    return toOperationWrite(
      await this.updateOperationUseCase.execute({ ...input, accessibleOwners, id }),
    );
  }

  async upsertValuation(
    userId: string,
    assetId: string,
    date: string,
    input: UpsertValuationApiInput,
  ) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const result = await this.upsertValuationUseCase.execute({
      accessibleOwners,
      assetId,
      date,
      unitPrice: input.unitPrice,
    });
    return { item: toValuation(result.valuation), position: toPosition(result.asset.position) };
  }
  // Resolved on every request: the caller plus every family they own or joined.
  private async getAccessibleOwners(userId: string): Promise<OwnerAccess[]> {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);
    return [
      { owner: OwnerType.USER, ownerId: userId },
      ...families.map(({ archived, familyId }) => ({
        archived,
        owner: OwnerType.FAMILY,
        ownerId: familyId,
      })),
    ];
  }
}
