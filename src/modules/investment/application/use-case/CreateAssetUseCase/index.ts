import { ConflictException, ForbiddenException, Inject } from '@nestjs/common';

import { CreateAssetInput, CreateAssetSchema } from '@investment/application/dto/CreateAsset';
import { AssetView, detailToListRow, toAssetView } from '@investment/application/service/AssetView';
import { ensureOwnerWritable } from '@investment/application/service/OwnerWritable';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { TickerValidator } from '@investment/application/service/TickerValidator';
import { today } from '@investment/application/service/Today';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export const TICKER_EXISTS_MESSAGE = 'You already have this ticker';

export class CreateAssetUseCase implements UseCaseWithParams<CreateAssetInput, AssetView> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
    private readonly tickers: TickerValidator,
  ) {}

  async execute(params: CreateAssetInput): Promise<AssetView> {
    const input = validate(CreateAssetSchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    if (!hasOwnerAccess(input.accessibleOwners, target)) {
      throw new ForbiddenException('Owner not accessible');
    }

    ensureOwnerWritable(input.accessibleOwners, target);

    const ticker = input.ticker ?? null;

    if (ticker && (await this.repository.findAssetByTicker(input.owner, input.ownerId, ticker))) {
      throw new ConflictException(TICKER_EXISTS_MESSAGE);
    }

    await this.tickers.validate(input.assetClass, ticker);

    const asset = await this.repository.createAsset({
      assetClass: input.assetClass,
      currency: input.currency,
      initialValuation: input.currentUnitPrice
        ? { date: today(), unitPrice: input.currentUnitPrice }
        : undefined,
      name: input.name,
      owner: input.owner,
      ownerId: input.ownerId,
      ticker,
    });
    const detail = await this.repository.findAssetById(asset.id);

    const row = detailToListRow(detail ?? { ...asset, operations: [], valuations: [] });

    return toAssetView(row, await this.quotes.load([row]));
  }
}
