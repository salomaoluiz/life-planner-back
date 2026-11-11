import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { RateInput } from '@investment/application/dto/FixedIncome';
import {
  AssetDetailView,
  OperationView,
  toAssetDetailView,
} from '@investment/application/service/AssetView';
import {
  loadWritableAsset,
  toPositionException,
} from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import {
  FixedIncomeData,
  FixedIncomeRateWrite,
  FixedIncomeTermsEntity,
  FixedIncomeTermsWrite,
} from '@investment/domain/entity/FixedIncomeEntity';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import {
  InvestmentAssetClass,
  InvestmentFixedIncomeLiquidity,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { FixedIncomeRedemptionTooLargeError } from '@investment/domain/error/FixedIncomeRedemptionTooLargeError';
import { IInvestmentRepository } from '@investment/domain/repository';
import { effectiveRateOf } from '@investment/domain/service/FixedIncomeRate';
import { Decimal8 } from '@shared/infra/decimal';

// A contribution or redemption: the refreshed detail, the operation as written and the liquidity warning (FR 23).
export interface FixedIncomeWriteResult {
  detail: AssetDetailView;
  liquidityWarning: InvestmentFixedIncomeLiquidity | null;
  operation: OperationView;
}

export const FIXED_INCOME_ACTIONS_MESSAGE = 'Use the fixed income actions for this title';
export const FIRST_RATE_MESSAGE = 'The first rate must start on or before the first contribution';
export const NOT_CALCULATED_MESSAGE = 'This asset is not a calculated title';
export const RATE_EXISTS_MESSAGE = 'There is already a rate starting on this date';
export const LAST_RATE_MESSAGE = 'A calculated title needs at least one rate';

export interface CalculatedTitle {
  asset: AssetDetail;
  data: { terms: FixedIncomeTermsEntity } & FixedIncomeData;
}

// The calculated data of an asset, undefined for any other asset (one read, only for FIXED_INCOME).
export async function findCalculatedData(
  repository: IInvestmentRepository,
  asset: { assetClass: string; id: string },
): Promise<({ terms: FixedIncomeTermsEntity } & FixedIncomeData) | undefined> {
  if (asset.assetClass !== InvestmentAssetClass.FIXED_INCOME) {
    return undefined;
  }

  const data = (await repository.findFixedIncomeByAssetIds([asset.id])).get(asset.id);

  return data?.terms ? { ...data, terms: data.terms } : undefined;
}
// FR 15: 102's generic operation and valuation writes are refused on a calculated title.
export async function assertNotCalculated(
  repository: IInvestmentRepository,
  asset: { assetClass: string; id: string },
): Promise<void> {
  if (asset.assetClass !== InvestmentAssetClass.FIXED_INCOME) {
    return;
  }

  if (await findCalculatedData(repository, asset)) {
    throw new UnprocessableEntityException(FIXED_INCOME_ACTIONS_MESSAGE);
  }
}
// FR 16-17: the number of lots' dates; the first rate must cover the earliest contribution.
export function assertRatesCoverContributions(
  rateStarts: string[],
  contributionDates: string[],
): void {
  if (rateStarts.length === 0) {
    throw new UnprocessableEntityException(LAST_RATE_MESSAGE);
  }
  if (
    contributionDates.length > 0 &&
    [...rateStarts].sort()[0] > [...contributionDates].sort()[0]
  ) {
    throw new UnprocessableEntityException(FIRST_RATE_MESSAGE);
  }
}
// FR 2: the maturity is after the first contribution; a grace date lies between the two (inclusive).
export function assertTermsConsistent(
  terms: FixedIncomeTermsWrite,
  firstContribution: string,
): void {
  if (terms.maturityDate <= firstContribution) {
    throw new UnprocessableEntityException('The maturity must be after the first contribution');
  }
  if (
    terms.liquidity === InvestmentFixedIncomeLiquidity.GRACE_PERIOD &&
    terms.liquidityDate &&
    (terms.liquidityDate < firstContribution || terms.liquidityDate > terms.maturityDate)
  ) {
    throw new BadRequestException({
      message: 'The grace period date must be between the first contribution and the maturity',
    });
  }
}
export function contributionDatesOf(asset: Pick<AssetDetail, 'operations'>): string[] {
  return asset.operations
    .filter((operation) => operation.type === InvestmentOperationType.BUY)
    .map((operation) => operation.date);
}
export async function detailViewOf(
  repository: IInvestmentRepository,
  quotes: QuoteContextLoader,
  assetId: string,
): Promise<AssetDetailView> {
  const detail = await repository.findAssetById(assetId);

  if (!detail) {
    throw new NotFoundException();
  }

  return toAssetDetailView(detail, await quotes.load([detail]));
}
// FR 24 of section 4: the amount in cents as the principal quantity in reais.
export async function loadCalculatedTitle(
  repository: IInvestmentRepository,
  assetId: string,
  owners: OwnerAccess[],
): Promise<CalculatedTitle> {
  const asset = await loadWritableAsset(repository, assetId, owners);
  const data = (await repository.findFixedIncomeByAssetIds([assetId])).get(assetId);

  if (!data?.terms) {
    throw new UnprocessableEntityException(NOT_CALCULATED_MESSAGE);
  }

  return { asset, data: { ...data, terms: data.terms } };
}
export function principalOf(amount: number): Decimal8 {
  return Decimal8.parse(`${Math.trunc(amount / 100)}.${String(amount % 100).padStart(2, '0')}`);
}
// FR 21 and FR 17 of 102: the two "does not fit anymore" errors answer 422 with where it breaks.
export async function mapFixedIncomeErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof FixedIncomeRedemptionTooLargeError) {
      throw new UnprocessableEntityException({
        details: { date: error.date, operationId: error.operationId },
        message: error.message,
      });
    }

    throw toPositionException(error);
  }
}
// FR 7: the effective rate is derived and stored with the entry.
export function toRateWrite(
  rate: Omit<RateInput, 'startDate'> | RateInput,
  startDate: string,
): FixedIncomeRateWrite {
  const fields = {
    annualRate: 'annualRate' in rate ? rate.annualRate : null,
    cdiPercent: 'cdiPercent' in rate ? rate.cdiPercent : null,
    indexRate: 'indexRate' in rate ? rate.indexRate : null,
    mode: rate.mode,
    spread: 'spread' in rate ? rate.spread : null,
  };

  return { ...fields, effectiveRate: effectiveRateOf(fields), startDate };
}
// FR 23: warn, never block.
export function liquidityWarningOf(
  terms: FixedIncomeTermsWrite,
  date: string,
): InvestmentFixedIncomeLiquidity | null {
  if (terms.liquidity === InvestmentFixedIncomeLiquidity.AT_MATURITY && date < terms.maturityDate) {
    return InvestmentFixedIncomeLiquidity.AT_MATURITY;
  }
  if (
    terms.liquidity === InvestmentFixedIncomeLiquidity.GRACE_PERIOD &&
    terms.liquidityDate &&
    date < terms.liquidityDate
  ) {
    return InvestmentFixedIncomeLiquidity.GRACE_PERIOD;
  }

  return null;
}
export async function resultOf(
  repository: IInvestmentRepository,
  quotes: QuoteContextLoader,
  assetId: string,
  operationId: string,
  liquidityWarning: InvestmentFixedIncomeLiquidity | null,
): Promise<FixedIncomeWriteResult> {
  const detail = await detailViewOf(repository, quotes, assetId);
  const operation = detail.operations.find((view) => view.operation.id === operationId);

  if (!operation) {
    throw new NotFoundException();
  }

  return { detail, liquidityWarning, operation };
}
