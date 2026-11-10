import { Inject, UnprocessableEntityException } from '@nestjs/common';

import {
  CreateFixedIncomeRedemptionInput,
  CreateFixedIncomeRedemptionSchema,
} from '@investment/application/dto/FixedIncome';
import {
  contributionDatesOf,
  FixedIncomeWriteResult,
  liquidityWarningOf,
  loadCalculatedTitle,
  mapFixedIncomeErrors,
  resultOf,
} from '@investment/application/service/FixedIncomeRules';
import { resolveOperationAccount } from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { InvestmentOperationType } from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { Decimal8 } from '@shared/infra/decimal';
import { validate } from '@shared/infra/validation';

export const BEFORE_FIRST_MESSAGE = 'A redemption cannot be dated before the first contribution';

// Spec 105 FR 19-23: the owner types the real net; the quantity, gross and withheld taxes are derived inside the
// write transaction (placeholders here), and the liquidity only warns.
// The `quantity > 0` CHECK needs a value before the recalculation writes the principal consumed.
const PLACEHOLDER_QUANTITY = Decimal8.parse('0.01');

export class CreateFixedIncomeRedemptionUseCase implements UseCaseWithParams<
  CreateFixedIncomeRedemptionInput,
  FixedIncomeWriteResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: CreateFixedIncomeRedemptionInput): Promise<FixedIncomeWriteResult> {
    const input = validate(CreateFixedIncomeRedemptionSchema, params);
    const { asset, data } = await loadCalculatedTitle(
      this.repository,
      input.assetId,
      input.accessibleOwners,
    );

    if (input.date < (contributionDatesOf(asset).sort()[0] ?? input.date)) {
      throw new UnprocessableEntityException(BEFORE_FIRST_MESSAGE);
    }

    if (input.generateTransaction && input.accountId) {
      await resolveOperationAccount(
        this.repository,
        input.accessibleOwners,
        input.accountId,
        'BRL',
      );
    }

    const operationId = await mapFixedIncomeErrors(async () =>
      this.repository.writeOperation({
        accountId: input.generateTransaction ? (input.accountId ?? null) : null,
        assetId: asset.id,
        assetLabel: asset.name,
        currency: 'BRL',
        date: input.date,
        fees: [],
        feesTotal: 0,
        fxRate: null,
        generateTransaction: input.generateTransaction,
        gross: 0,
        netAmount: input.netAmount,
        quantity: PLACEHOLDER_QUANTITY,
        redemptionKind: input.kind,
        total: input.netAmount,
        type: InvestmentOperationType.SELL,
        unitPrice: Decimal8.parse('1'),
      }),
    );

    return resultOf(
      this.repository,
      this.quotes,
      asset.id,
      operationId,
      liquidityWarningOf(data.terms, input.date),
    );
  }
}
