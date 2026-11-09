import { Inject, UnprocessableEntityException } from '@nestjs/common';

import { UpdateTransferInput, UpdateTransferSchema } from '@finance/application/dto/UpdateTransfer';
import {
  applyTransferRules,
  loadWritableSides,
  sidesToRepository,
  TRANSFER_ACCOUNT_ARCHIVED,
} from '@finance/application/service/TransferSides';
import { MaterializationGate } from '@finance/application/service/MaterializationGate';
import { GetTransferUseCase } from '@finance/application/use-case/GetTransferUseCase';
import TransferEntity from '@finance/domain/entity/TransferEntity';
import { AccountStatus, InstallmentEditScope } from '@finance/domain/enum';
import {
  IFinanceAccountRepository,
  IFinanceTransferRepository,
  WriteTransferRepositoryParams,
} from '@finance/domain/repository';
import {
  assertAccounts,
  assertDates,
  resolveAmountIn,
} from '@finance/domain/service/TransferRules';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Rows of an archived account only follow `paid` and `notes` (spec 098 section 4).
const ARCHIVED_EDITABLE = ['accessibleOwners', 'id', 'notes', 'paid', 'scope'];
// THIS_AND_NEXT changes the series template: only what every occurrence shares.
const SERIES_FIELDS = [
  'accessibleOwners',
  'amountIn',
  'amountOut',
  'description',
  'id',
  'notes',
  'scope',
];
export const SCOPE_FIELDS_MESSAGE = 'Scope only supports amount, description and notes';

export class UpdateTransferUseCase implements UseCaseWithParams<
  UpdateTransferInput,
  TransferEntity
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject(GetTransferUseCase)
    private readonly getTransferUseCase: GetTransferUseCase,
    @Inject(MaterializationGate)
    private readonly materializationGate: MaterializationGate,
    @Inject('IFinanceTransferRepository')
    private readonly transferRepository: IFinanceTransferRepository,
  ) {}

  async execute(params: UpdateTransferInput): Promise<TransferEntity> {
    const input = validate(UpdateTransferSchema, params);
    const stored = await this.getTransferUseCase.execute(input);

    // Spec 034: an occurrence of a series asks the scope.
    if (stored.recurrenceId !== null && input.scope === undefined) {
      throw new UnprocessableEntityException('Choose the edit scope');
    }

    const wide = stored.recurrenceId !== null && input.scope === InstallmentEditScope.THIS_AND_NEXT;

    if (
      wide &&
      Object.keys(params).some(
        (key) =>
          (params as Record<string, unknown>)[key] !== undefined && !SERIES_FIELDS.includes(key),
      )
    ) {
      throw new UnprocessableEntityException(SCOPE_FIELDS_MESSAGE);
    }

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

    const write = {
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
    };
    const updated = await this.transferRepository.updateTransfer(stored.id, write);

    if (wide) {
      await this.applyToLaterOccurrences(stored, write, sides);
    }

    return updated;
  }

  // THIS_AND_NEXT: the later UNPAID occurrences and the series template follow the shared fields. The amount in follows
  // the amount out for the same currency; for different ones each occurrence keeps its own (none until it is paid).
  private async applyToLaterOccurrences(
    stored: TransferEntity,
    shared: Pick<WriteTransferRepositoryParams, 'amountOut' | 'description' | 'notes'>,
    sides: Awaited<ReturnType<typeof loadWritableSides>>,
  ): Promise<void> {
    const recurrenceId = stored.recurrenceId as string;
    const sameCurrency = sides.from.currency === sides.to.currency;
    const later = (
      await this.transferRepository.findSeriesTransfersFrom(
        recurrenceId,
        (stored.occurrenceNumber as number) + 1,
      )
    ).filter((item) => !item.paid);

    for (const item of later) {
      await this.transferRepository.updateTransfer(item.id, {
        amountIn: sameCurrency ? shared.amountOut : item.amountIn,
        amountOut: shared.amountOut,
        createdBy: item.createdBy,
        dateIn: item.dateIn,
        dateOut: item.dateOut,
        description: shared.description,
        fee: item.fee,
        notes: shared.notes,
        occurrenceNumber: item.occurrenceNumber,
        paid: item.paid,
        recurrenceId,
        ...sidesToRepository(sides),
      });
    }
    await this.transferRepository.updateSeriesTemplate(recurrenceId, {
      amountIn: sameCurrency ? shared.amountOut : null,
      amountOut: shared.amountOut,
      description: shared.description,
      notes: shared.notes,
    });
    this.materializationGate.invalidate([sides.from.ownerId]);
  }
}
