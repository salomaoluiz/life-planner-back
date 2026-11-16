import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { detailToListRow, toAssetView } from '@investment/application/service/AssetView';
import {
  ConversionWriteResult,
  linksOf,
  toConversionView,
} from '@investment/application/service/ConversionView';
import { toPositionException } from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { ConversionDetail } from '@investment/domain/entity/ConversionEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { isConversionType } from '@investment/domain/enum';
import { ConversionLaterOperationsError } from '@investment/domain/error/ConversionLaterOperationsError';
import { IInvestmentRepository } from '@investment/domain/repository';

export const CONVERSION_CHAIN_LOCKED_CODE = 'CONVERSION_CHAIN_LOCKED';
export const USE_CONVERSION_ROUTE_CODE = 'USE_CONVERSION_ROUTE';
export const USE_CONVERSION_ROUTE_MESSAGE = 'Edit the conversion instead.';
export const ARCHIVED_DESTINATION_MESSAGE = "Archived assets can't receive a conversion";
export const FIXED_INCOME_CONVERSION_MESSAGE = "Conversions don't apply to fixed income";
export const PAIR_MISMATCH_MESSAGE = 'A conversion needs two assets of the same class and currency';

// Spec 112 FR 19: only the last conversion of a chain can be edited or deleted.
export function assertNotLocked(
  repositoryConversion: ConversionDetail,
  destinationTicker: string,
): void {
  if (repositoryConversion.locked) {
    throw new UnprocessableEntityException({
      code: CONVERSION_CHAIN_LOCKED_CODE,
      message: `Delete the conversion from ${destinationTicker} on ${repositoryConversion.date} first.`,
    });
  }
}

// Spec 112: a conversion operation changes only through its conversion.
export function assertNotConversionOperation(operation: Pick<OperationEntity, 'type'>): void {
  if (isConversionType(operation.type)) {
    throw new UnprocessableEntityException({
      code: USE_CONVERSION_ROUTE_CODE,
      message: USE_CONVERSION_ROUTE_MESSAGE,
    });
  }
}

// What the write transaction refuses answers 422 with where it breaks (spec 112 FR 4, 5, 13, 18, 20).
export function toConversionException(error: unknown): unknown {
  if (error instanceof ConversionLaterOperationsError) {
    return new UnprocessableEntityException({
      details: { date: error.date, operations: error.operations },
      message: error.message,
    });
  }

  return toPositionException(error);
}

// The refreshed item and both positions, read back after the transaction.
export async function readConversionResult(
  repository: IInvestmentRepository,
  quotes: QuoteContextLoader,
  conversionId: string,
): Promise<ConversionWriteResult> {
  const conversion = await repository.findConversionById(conversionId);
  const origin = conversion ? await repository.findAssetById(conversion.fromAssetId) : undefined;
  const destination = conversion ? await repository.findAssetById(conversion.toAssetId) : undefined;

  if (!conversion || !origin || !destination) {
    throw new NotFoundException();
  }

  const rows = [detailToListRow(origin), detailToListRow(destination)];
  const context = await quotes.load(rows);

  return {
    fromPosition: {
      ...toAssetView(rows[0], context),
      ...linksOf(origin.id, [conversion]),
    },
    item: toConversionView(conversion, origin, destination),
    toPosition: {
      ...toAssetView(rows[1], context),
      ...linksOf(destination.id, [conversion]),
    },
  };
}
