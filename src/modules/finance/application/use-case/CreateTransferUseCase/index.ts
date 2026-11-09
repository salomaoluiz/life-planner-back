import { Inject } from '@nestjs/common';

import { CreateTransferInput, CreateTransferSchema } from '@finance/application/dto/CreateTransfer';
import {
  applyTransferRules,
  loadWritableSides,
  sidesToRepository,
} from '@finance/application/service/TransferSides';
import TransferEntity from '@finance/domain/entity/TransferEntity';
import { IFinanceAccountRepository, IFinanceTransferRepository } from '@finance/domain/repository';
import { RecurrenceStatus } from '@finance/domain/enum';
import { lastDayOfMonth, planMaterialization } from '@finance/domain/service/RecurrenceSchedule';
import {
  assertAccounts,
  assertDates,
  resolveAmountIn,
} from '@finance/domain/service/TransferRules';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class CreateTransferUseCase implements UseCaseWithParams<
  CreateTransferInput,
  TransferEntity
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceTransferRepository')
    private readonly transferRepository: IFinanceTransferRepository,
  ) {}

  async execute(params: CreateTransferInput): Promise<TransferEntity> {
    const input = validate(CreateTransferSchema, params);

    applyTransferRules(() => assertAccounts(input.fromAccountId, input.toAccountId));
    const sides = await loadWritableSides(this.accountRepository, input);
    const dateIn = input.dateIn ?? input.dateOut;

    applyTransferRules(() => assertDates(input.dateOut, dateIn));
    const amountIn = applyTransferRules(() =>
      resolveAmountIn({
        amountIn: input.amountIn,
        amountOut: input.amountOut,
        currencyIn: sides.to.currency,
        currencyOut: sides.from.currency,
        isSeriesOccurrence: input.recurrenceId != null,
        paid: input.paid,
      }),
    );

    const write = {
      amountIn,
      amountOut: input.amountOut,
      createdBy: input.requesterId,
      dateIn,
      dateOut: input.dateOut,
      description: input.description,
      fee: input.fee ?? null,
      notes: input.notes ?? null,
      occurrenceNumber: input.occurrenceNumber ?? null,
      paid: input.paid,
      recurrenceId: input.recurrenceId ?? null,
      ...sidesToRepository(sides),
    };

    if (input.recurrence === undefined) {
      return this.transferRepository.createTransfer(write);
    }

    // Occurrence 1 is what the user typed; the others due up to the end of the month follow the series: unpaid, the
    // fixed amount in for the same currency and none for different ones (it is typed when each is paid).
    const plan = planMaterialization({
      firstNumber: 1,
      horizon: lastDayOfMonth(input.today ?? input.dateOut),
      lastGeneratedNumber: 0,
      rule: {
        endDate: input.recurrence.endDate,
        frequency: input.recurrence.frequency,
        startDate: input.dateOut,
      },
      skippedNumbers: [],
    });

    return this.transferRepository.createTransferSeries({
      endDate: input.recurrence.endDate ?? null,
      frequency: input.recurrence.frequency,
      lastGeneratedNumber: plan.lastGeneratedNumber,
      nextOccurrenceDate: plan.nextOccurrenceDate,
      occurrences: plan.occurrences.map((occurrence) =>
        occurrence.number === 1
          ? { ...write, occurrenceNumber: 1 }
          : {
              ...write,
              amountIn: sides.from.currency === sides.to.currency ? input.amountOut : null,
              dateIn: occurrence.date,
              dateOut: occurrence.date,
              fee: null,
              occurrenceNumber: occurrence.number,
              paid: false,
            },
      ),
      status: plan.status as RecurrenceStatus,
    });
  }
}
