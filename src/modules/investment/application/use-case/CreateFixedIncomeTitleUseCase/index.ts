import { ForbiddenException, Inject } from '@nestjs/common';

import {
  CreateFixedIncomeTitleInput,
  CreateFixedIncomeTitleSchema,
} from '@investment/application/dto/FixedIncome';
import { AssetDetailView } from '@investment/application/service/AssetView';
import {
  assertTermsConsistent,
  detailViewOf,
  mapFixedIncomeErrors,
  principalOf,
  toRateWrite,
} from '@investment/application/service/FixedIncomeRules';
import { resolveOperationAccount } from '@investment/application/service/OperationRules';
import { ensureOwnerWritable } from '@investment/application/service/OwnerWritable';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { Decimal8 } from '@shared/infra/decimal';
import { validate } from '@shared/infra/validation';

// Spec 105 FR 3: the asset, its terms, its first rate and its first contribution in ONE transaction.
export class CreateFixedIncomeTitleUseCase implements UseCaseWithParams<
  CreateFixedIncomeTitleInput,
  AssetDetailView
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: CreateFixedIncomeTitleInput): Promise<AssetDetailView> {
    const input = validate(CreateFixedIncomeTitleSchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    if (!hasOwnerAccess(input.accessibleOwners, target)) {
      throw new ForbiddenException('Owner not accessible');
    }

    ensureOwnerWritable(input.accessibleOwners, target);

    const { contribution } = input;

    assertTermsConsistent(
      { ...input.terms, liquidityDate: input.terms.liquidityDate ?? null },
      contribution.date,
    );

    if (contribution.generateTransaction && contribution.accountId) {
      await resolveOperationAccount(
        this.repository,
        input.accessibleOwners,
        contribution.accountId,
        'BRL',
      );
    }

    const { assetId } = await mapFixedIncomeErrors(async () =>
      this.repository.createFixedIncomeTitle({
        asset: {
          assetClass: InvestmentAssetClass.FIXED_INCOME,
          currency: 'BRL',
          name: input.name,
          owner: input.owner,
          ownerId: input.ownerId,
          ticker: null,
        },
        contribution: {
          accountId: contribution.generateTransaction ? (contribution.accountId ?? null) : null,
          assetLabel: input.name,
          currency: 'BRL',
          date: contribution.date,
          fees: [],
          feesTotal: 0,
          fxRate: null,
          generateTransaction: contribution.generateTransaction,
          gross: contribution.amount,
          quantity: principalOf(contribution.amount),
          total: contribution.amount,
          type: InvestmentOperationType.BUY,
          unitPrice: Decimal8.parse('1'),
        },
        rate: toRateWrite(input.rate, contribution.date),
        terms: { ...input.terms, liquidityDate: input.terms.liquidityDate ?? null },
      }),
    );

    return detailViewOf(this.repository, this.quotes, assetId);
  }
}
