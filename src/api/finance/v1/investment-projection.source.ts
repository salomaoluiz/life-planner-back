import { Inject, Injectable } from '@nestjs/common';

import { CurrencyCode } from '@finance/domain/enum/Currency';
import { ExternalProjectedIncome, IExternalProjectionSource } from '@finance/domain/repository';
import { GetIncomeSeriesProjectionsUseCase } from '@investment/application/use-case/GetIncomeSeriesProjectionsUseCase';
import { MaterializeIncomeSeriesUseCase } from '@investment/application/use-case/MaterializeIncomeSeriesUseCase';

// Spec 115 FR 18, 22: the aggregation of the API layer. Finance asks for what it owes before a read and for the
// projected incomes of the investment series; only series in finance (account and category set) are served.
@Injectable()
export class InvestmentProjectionSource implements IExternalProjectionSource {
  constructor(
    @Inject(MaterializeIncomeSeriesUseCase)
    private readonly materializeUseCase: MaterializeIncomeSeriesUseCase,
    @Inject(GetIncomeSeriesProjectionsUseCase)
    private readonly projectionsUseCase: GetIncomeSeriesProjectionsUseCase,
  ) {}

  async findProjections(
    params: Parameters<IExternalProjectionSource['findProjections']>[0],
  ): Promise<ExternalProjectedIncome[]> {
    const items = await this.projectionsUseCase.execute({
      accessibleOwners: params.owners,
      from: params.from,
      to: params.to,
      today: params.today,
    });

    return items.flatMap((item) =>
      item.withFinance && item.accountId && item.categoryId
        ? [
            {
              accountId: item.accountId,
              assetId: item.assetId,
              categoryId: item.categoryId,
              currency: item.currency as CurrencyCode,
              date: item.paymentDate,
              description: item.assetLabel,
              number: item.number,
              seriesId: item.seriesId,
              value: item.netAmount,
            },
          ]
        : [],
    );
  }

  async materialize(
    params: Parameters<IExternalProjectionSource['materialize']>[0],
  ): Promise<void> {
    await this.materializeUseCase.execute({ accessibleOwners: params.owners, today: params.today });
  }
}
