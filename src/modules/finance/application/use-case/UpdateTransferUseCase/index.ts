import { Inject, UnprocessableEntityException } from '@nestjs/common';

import { UpdateTransferInput, UpdateTransferSchema } from '@finance/application/dto/UpdateTransfer';
import {
  applyTransferRules,
  loadWritableSides,
  sidesToRepository,
  TRANSFER_ACCOUNT_ARCHIVED,
} from '@finance/application/service/TransferSides';
import { GetTransferUseCase } from '@finance/application/use-case/GetTransferUseCase';
import TransferEntity from '@finance/domain/entity/TransferEntity';
import { AccountStatus } from '@finance/domain/enum';
import { IFinanceAccountRepository, IFinanceTransferRepository } from '@finance/domain/repository';
import {
  assertAccounts,
  assertDates,
  resolveAmountIn,
} from '@finance/domain/service/TransferRules';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Rows of an archived account only follow `paid` and `notes` (spec 098 section 4).
const ARCHIVED_EDITABLE = ['accessibleOwners', 'id', 'notes', 'paid'];

export class UpdateTransferUseCase implements UseCaseWithParams<
  UpdateTransferInput,
  TransferEntity
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject(GetTransferUseCase)
    private readonly getTransferUseCase: GetTransferUseCase,
    @Inject('IFinanceTransferRepository')
    private readonly transferRepository: IFinanceTransferRepository,
  ) {}

  async execute(params: UpdateTransferInput): Promise<TransferEntity> {
    const input = validate(UpdateTransferSchema, params);
    const stored = await this.getTransferUseCase.execute(input);

    const touchedKeys = Object.keys(params).filter(
      (key) => (params as Record<string, unknown>)[key] !== undefined,
    );
    const onlyPaidOrNotes = touchedKeys.every((key) => ARCHIVED_EDITABLE.includes(key));
    const current = await loadWritableSides(this.accountRepository, {
      accessibleOwners: input.accessibleOwners,
      allowArchived: true,
      fromAccountId: stored.fromAccountId as string,
      toAccountId: stored.toAccountId as string,
    });

    if (
      !onlyPaidOrNotes &&
      [current.from, current.to].some((account) => account.status === AccountStatus.ARCHIVED)
    ) {
      throw new UnprocessableEntityException(TRANSFER_ACCOUNT_ARCHIVED);
    }

    const fromAccountId = input.fromAccountId ?? (stored.fromAccountId as string);
    const toAccountId = input.toAccountId ?? (stored.toAccountId as string);

    applyTransferRules(() => assertAccounts(fromAccountId, toAccountId));
    const sides =
      fromAccountId === stored.fromAccountId && toAccountId === stored.toAccountId
        ? current
        : await loadWritableSides(this.accountRepository, {
            accessibleOwners: input.accessibleOwners,
            fromAccountId,
            toAccountId,
          });
    const amountOut = input.amountOut ?? stored.amountOut;
    const dateOut = input.dateOut ?? stored.dateOut;
    // A transfer dated on one day keeps both sides together when only the out date moves.
    const dateIn = input.dateIn ?? (stored.dateIn === stored.dateOut ? dateOut : stored.dateIn);
    const paid = input.paid ?? stored.paid;

    applyTransferRules(() => assertDates(dateOut, dateIn));
    const sameCurrency = sides.from.currency === sides.to.currency;
    const amountIn = applyTransferRules(() =>
      resolveAmountIn({
        // Same currency: the amount in follows the amount out unless the caller typed it.
        amountIn: sameCurrency ? input.amountIn : (input.amountIn ?? stored.amountIn),
        amountOut,
        currencyIn: sides.to.currency,
        currencyOut: sides.from.currency,
        isSeriesOccurrence: stored.recurrenceId !== null,
        paid,
      }),
    );

    return this.transferRepository.updateTransfer(stored.id, {
      amountIn,
      amountOut,
      createdBy: stored.createdBy,
      dateIn,
      dateOut,
      description: input.description ?? stored.description,
      fee: input.fee === undefined ? stored.fee : input.fee,
      notes: input.notes === undefined ? stored.notes : input.notes,
      occurrenceNumber: stored.occurrenceNumber,
      paid,
      recurrenceId: stored.recurrenceId,
      ...sidesToRepository(sides),
    });
  }
}
