import { Inject, UnprocessableEntityException } from '@nestjs/common';

import {
  UpsertFixedIncomeTermsInput,
  UpsertFixedIncomeTermsSchema,
} from '@investment/application/dto/FixedIncome';
import { AssetDetailView } from '@investment/application/service/AssetView';
import {
  assertRatesCoverContributions,
  assertTermsConsistent,
  contributionDatesOf,
  detailViewOf,
  mapFixedIncomeErrors,
  RATE_EXISTS_MESSAGE,
  toRateWrite,
} from '@investment/application/service/FixedIncomeRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export const NOT_FIXED_INCOME_MESSAGE = 'Only fixed income assets can have terms';
export const BRL_ONLY_MESSAGE = 'Calculated titles are in BRL only';
export const RATE_REQUIRED_MESSAGE = 'A rate is required to calculate this title';
export const NO_CONTRIBUTION_MESSAGE = 'Add a contribution before calculating this title';

// Spec 105 FR 4-5: set or edit the terms; a manual FIXED_INCOME asset is converted when it gets terms and a rate.
export class UpsertFixedIncomeTermsUseCase implements UseCaseWithParams<
  UpsertFixedIncomeTermsInput,
  AssetDetailView
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: UpsertFixedIncomeTermsInput): Promise<AssetDetailView> {
    const input = validate(UpsertFixedIncomeTermsSchema, params);
    const asset = await loadWritableAsset(this.repository, input.assetId, input.accessibleOwners);

    if (asset.assetClass !== InvestmentAssetClass.FIXED_INCOME) {
      throw new UnprocessableEntityException(NOT_FIXED_INCOME_MESSAGE);
    }
    if (asset.currency !== 'BRL') {
      throw new UnprocessableEntityException(BRL_ONLY_MESSAGE);
    }

    const existing = (await this.repository.findFixedIncomeByAssetIds([asset.id])).get(asset.id);
    const convert = !existing?.terms;
    const contributions = contributionDatesOf(asset).sort();
    const terms = { ...input.terms, liquidityDate: input.terms.liquidityDate ?? null };

    if (convert && !input.rate) {
      throw new UnprocessableEntityException(RATE_REQUIRED_MESSAGE);
    }
    if (convert && contributions.length === 0) {
      throw new UnprocessableEntityException(NO_CONTRIBUTION_MESSAGE);
    }
    assertTermsConsistent(terms, contributions[0] ?? terms.maturityDate);

    const rate = convert && input.rate ? toRateWrite(input.rate, input.rate.startDate) : undefined;

    if (rate) {
      assertRatesCoverContributions([rate.startDate], contributions);
    }
    if (!convert && input.rate) {
      throw new UnprocessableEntityException(RATE_EXISTS_MESSAGE);
    }

    await mapFixedIncomeErrors(async () =>
      this.repository.saveFixedIncomeTerms({ assetId: asset.id, convert, rate, terms }),
    );

    return detailViewOf(this.repository, this.quotes, asset.id);
  }
}
