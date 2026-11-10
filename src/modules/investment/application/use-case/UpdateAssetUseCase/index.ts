import {
  ConflictException,
  ForbiddenException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { UpdateAssetInput, UpdateAssetSchema } from '@investment/application/dto/UpdateAsset';
import { AssetView, detailToListRow, toAssetView } from '@investment/application/service/AssetView';
import { ensureOwnerWritable } from '@investment/application/service/OwnerWritable';
import { TICKER_EXISTS_MESSAGE } from '@investment/application/use-case/CreateAssetUseCase';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentAssetStatus, TICKER_REQUIRED_CLASSES } from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { validate } from '@shared/infra/validation';

export const CLASS_LOCKED_MESSAGE = "Class and currency can't change after the first operation";

export class UpdateAssetUseCase implements UseCaseWithParams<UpdateAssetInput, AssetView> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: UpdateAssetInput): Promise<AssetView> {
    const input = validate(UpdateAssetSchema, params);
    const asset = await this.repository.findAssetById(input.id);

    // 404 first (never confirm another owner's ids), then 403 for the destination owner.
    if (!asset || !hasOwnerAccess(input.accessibleOwners, asset)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, asset);

    const target =
      input.owner !== undefined && input.ownerId !== undefined
        ? { owner: input.owner, ownerId: input.ownerId }
        : { owner: asset.owner, ownerId: asset.ownerId };

    if (!hasOwnerAccess(input.accessibleOwners, target)) {
      throw new ForbiddenException('Owner not accessible');
    }

    ensureOwnerWritable(input.accessibleOwners, target);

    const assetClass = input.assetClass ?? asset.assetClass;
    const classChanged = input.assetClass !== undefined && input.assetClass !== asset.assetClass;
    const currencyChanged = input.currency !== undefined && input.currency !== asset.currency;

    if ((classChanged || currencyChanged) && asset.operations.length > 0) {
      throw new UnprocessableEntityException(CLASS_LOCKED_MESSAGE);
    }

    const ticker = input.ticker === undefined ? asset.ticker : input.ticker;

    if (TICKER_REQUIRED_CLASSES.includes(assetClass) && !ticker) {
      throw new ValidationError([
        { code: 'custom', field: 'ticker', message: 'Ticker is required for this class' },
      ]);
    }

    const ownerChanged = target.owner !== asset.owner || target.ownerId !== asset.ownerId;

    if (ticker && (ownerChanged || ticker !== asset.ticker)) {
      const existing = await this.repository.findAssetByTicker(
        target.owner,
        target.ownerId,
        ticker,
      );

      if (existing && existing.id !== asset.id) {
        throw new ConflictException(TICKER_EXISTS_MESSAGE);
      }
    }

    const updated = await this.repository.updateAsset({
      archivedAt: archivedAtFor(input.status, asset.status),
      assetClass: input.assetClass,
      currency: input.currency,
      id: asset.id,
      name: input.name,
      owner: input.owner,
      ownerId: input.ownerId,
      status: input.status,
      ticker: input.ticker,
    });
    const detail = await this.repository.findAssetById(asset.id);

    return toAssetView(detailToListRow(detail ?? { ...updated, operations: [], valuations: [] }));
  }
}

// Archiving stamps the day once; reactivating clears it; other edits leave it alone.
function archivedAtFor(
  next: InvestmentAssetStatus | undefined,
  current: InvestmentAssetStatus,
): Date | null | undefined {
  if (next === InvestmentAssetStatus.ARCHIVED && current !== InvestmentAssetStatus.ARCHIVED) {
    return new Date();
  }

  return next === InvestmentAssetStatus.ACTIVE ? null : undefined;
}
