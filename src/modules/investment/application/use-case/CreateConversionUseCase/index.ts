import {
  BadRequestException,
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  CreateConversionInput,
  CreateConversionSchema,
} from '@investment/application/dto/ConversionInput';
import { ConversionWriteResult } from '@investment/application/service/ConversionView';
import {
  ARCHIVED_DESTINATION_MESSAGE,
  FIXED_INCOME_CONVERSION_MESSAGE,
  PAIR_MISMATCH_MESSAGE,
  readConversionResult,
  toConversionException,
} from '@investment/application/service/ConversionWrite';
import {
  loadWritableAsset,
  resolveOperationAccount,
} from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { TickerValidator } from '@investment/application/service/TickerValidator';
import { TICKER_EXISTS_MESSAGE } from '@investment/application/use-case/CreateAssetUseCase';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentAssetClass, InvestmentAssetStatus } from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
import { checkAssetPair } from '@investment/domain/service/ConversionRules';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 112 FR 1-7, 14-17: the whole position of the origin becomes the destination, in one transaction.
export class CreateConversionUseCase implements UseCaseWithParams<
  CreateConversionInput,
  ConversionWriteResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
    private readonly tickers: TickerValidator,
  ) {}

  async execute(params: CreateConversionInput): Promise<ConversionWriteResult> {
    const input = validate(CreateConversionSchema, params);
    const origin = await loadWritableAsset(this.repository, input.assetId, input.accessibleOwners);

    if (origin.assetClass === InvestmentAssetClass.FIXED_INCOME) {
      throw new BadRequestException(FIXED_INCOME_CONVERSION_MESSAGE);
    }

    const destination =
      'assetId' in input.destination
        ? await this.existingDestination(origin, input.destination.assetId, input.accessibleOwners)
        : await this.newDestination(origin, input.destination.newAsset);

    if (input.generateTransaction && input.accountId) {
      await resolveOperationAccount(
        this.repository,
        input.accessibleOwners,
        input.accountId,
        origin.currency,
      );
    }

    let conversionId: string;

    try {
      conversionId = await this.repository.writeConversion({
        accountId: input.generateTransaction ? (input.accountId ?? null) : null,
        assetLabel: origin.ticker ?? origin.name,
        cashAmount: input.cashAmount ?? null,
        cashReferenceUnitValue: input.cashReferenceUnitValue ?? null,
        currency: origin.currency,
        date: input.date,
        destination,
        fromAssetId: origin.id,
        generateTransaction: input.generateTransaction,
        ratioFrom: input.ratioFrom,
        ratioTo: input.ratioTo,
      });
    } catch (error) {
      throw toConversionException(error);
    }

    return readConversionResult(this.repository, this.quotes, conversionId);
  }

  private async existingDestination(
    origin: AssetDetail,
    assetId: string,
    owners: Parameters<typeof hasOwnerAccess>[0],
  ): Promise<{ assetId: string }> {
    const destination = await this.repository.findAssetById(assetId);

    if (!destination || !hasOwnerAccess(owners, destination)) {
      throw new NotFoundException();
    }
    if (destination.id === origin.id) {
      throw new BadRequestException('Origin and destination must be different assets');
    }
    if (destination.owner !== origin.owner || destination.ownerId !== origin.ownerId) {
      throw new BadRequestException('The destination must belong to the same owner');
    }

    const violation = checkAssetPair(origin, destination);

    if (violation === 'FIXED_INCOME') {
      throw new BadRequestException(FIXED_INCOME_CONVERSION_MESSAGE);
    }
    if (violation) {
      throw new BadRequestException(PAIR_MISMATCH_MESSAGE);
    }
    if (destination.status === InvestmentAssetStatus.ARCHIVED) {
      throw new UnprocessableEntityException(ARCHIVED_DESTINATION_MESSAGE);
    }

    return { assetId: destination.id };
  }

  // FR 6: class, currency and owner come from the origin; 104's ticker validation and 111's class check apply.
  private async newDestination(
    origin: AssetDetail,
    newAsset: { name: string; ticker: string },
  ): Promise<{ newAsset: Parameters<IInvestmentRepository['createAsset']>[0] }> {
    if (await this.repository.findAssetByTicker(origin.owner, origin.ownerId, newAsset.ticker)) {
      throw new ConflictException(TICKER_EXISTS_MESSAGE);
    }

    await this.tickers.validate(origin.assetClass, newAsset.ticker);

    return {
      newAsset: {
        assetClass: origin.assetClass,
        currency: origin.currency,
        name: newAsset.name,
        owner: origin.owner,
        ownerId: origin.ownerId,
        ticker: newAsset.ticker,
      },
    };
  }
}
