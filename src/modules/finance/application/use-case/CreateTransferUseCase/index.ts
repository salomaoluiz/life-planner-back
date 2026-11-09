import { Inject } from '@nestjs/common';

import { CreateTransferInput, CreateTransferSchema } from '@finance/application/dto/CreateTransfer';
import {
  applyTransferRules,
  loadWritableSides,
  sidesToRepository,
} from '@finance/application/service/TransferSides';
import TransferEntity from '@finance/domain/entity/TransferEntity';
import { IFinanceAccountRepository, IFinanceTransferRepository } from '@finance/domain/repository';
import { assertAccounts, assertDates, resolveAmountIn } from '@finance/domain/service/TransferRules';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class CreateTransferUseCase implements UseCaseWithParams<CreateTransferInput, TransferEntity> {
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

    return this.transferRepository.createTransfer({
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
    });
  }
}
