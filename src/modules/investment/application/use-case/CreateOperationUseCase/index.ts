import { Inject } from '@nestjs/common';

import {
  CreateOperationInput,
  CreateOperationSchema,
} from '@investment/application/dto/OperationInput';
import { assertNotCalculated } from '@investment/application/service/FixedIncomeRules';
import {
  loadWritableAsset,
  OperationWriteResult,
  persistOperation,
} from '@investment/application/service/OperationRules';
import { QuoteContextLoader, USD_BRL } from '@investment/application/service/QuoteContext';
import { IInvestmentRepository, IQuoteRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 102 FR 9-14, 19: a buy or sell with its fees and, optionally, the linked finance row.
export class CreateOperationUseCase implements UseCaseWithParams<
  CreateOperationInput,
  OperationWriteResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    @Inject('IQuoteRepository')
    private readonly quotes: IQuoteRepository,
    private readonly context: QuoteContextLoader,
  ) {}

  async execute(params: CreateOperationInput): Promise<OperationWriteResult> {
    const input = validate(CreateOperationSchema, params);
    const asset = await loadWritableAsset(this.repository, input.assetId, input.accessibleOwners);

    await assertNotCalculated(this.repository, asset);

    return persistOperation(this.repository, {
      accountId: input.accountId ?? null,
      asset,
      context: await this.context.load([asset]),
      date: input.date,
      fees: input.fees,
      fxRate:
        input.fxRate === undefined
          ? await this.defaultFxRate(asset.currency, input.date)
          : input.fxRate,
      generateTransaction: input.generateTransaction,
      owners: input.accessibleOwners,
      quantity: input.quantity,
      type: input.type,
      unitPrice: input.unitPrice,
    });
  }

  // Spec 104 FR 27: a USD operation defaults to the rate of its date, else the latest rate; BRL has none.
  private async defaultFxRate(currency: string, date: string): Promise<null | string> {
    if (currency !== 'USD') {
      return null;
    }

    return (
      (await this.quotes.findFxOnOrBefore(USD_BRL, date)) ??
      (await this.quotes.findFx(USD_BRL))?.rate ??
      null
    );
  }
}
