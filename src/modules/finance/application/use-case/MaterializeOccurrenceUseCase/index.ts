import {
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  MaterializeOccurrenceInput,
  MaterializeOccurrenceSchema,
} from '@finance/application/dto/MaterializeOccurrence';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { TransactionWithLimit } from '@finance/application/use-case/CreateTransactionUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceRecurrenceRepository } from '@finance/domain/repository';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { occurrenceDate } from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 034 FR 21: editing "only this one" of a PROJECTED occurrence makes it real now (unpaid, in the future);
// the series skips it when the horizon reaches it.
export class MaterializeOccurrenceUseCase implements UseCaseWithParams<
  MaterializeOccurrenceInput,
  TransactionWithLimit
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureTransactionConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: MaterializeOccurrenceInput): Promise<TransactionWithLimit> {
    const input = validate(MaterializeOccurrenceSchema, params);
    const series = await this.recurrenceRepository.findById(input.recurrenceId);

    if (!series || !hasOwnerAccess(input.accessibleOwners, series)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, series);

    const k = input.occurrenceNumber - series.firstNumber + 1;
    const scheduled = k >= 1 ? occurrenceDate(series, k) : undefined;

    if (scheduled === undefined || (series.endDate && scheduled > series.endDate)) {
      throw new NotFoundException('Occurrence not found');
    }
    if (series.skippedNumbers.includes(input.occurrenceNumber)) {
      throw new NotFoundException('Occurrence was deleted');
    }
    if (k <= series.lastGeneratedNumber) {
      throw new ConflictException('Occurrence is already real');
    }

    if (series.creditCardId && input.paid !== undefined) {
      throw new UnprocessableEntityException('Card purchases follow their invoice');
    }

    const { card } = await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      accountId: series.accountId ?? undefined,
      blockArchivedAccount: false,
      categoryId: input.categoryId ?? series.categoryId,
      creditCardId: series.creditCardId ?? undefined,
      owner: series.owner,
      ownerId: series.ownerId,
      type: series.type,
    });
    const date = input.date ?? scheduled;

    const transaction = await this.recurrenceRepository.createOccurrence({
      categoryId: input.categoryId,
      date,
      description: input.description,
      invoiceMonth: card ? invoiceMonthOf(date, card.closingDay) : undefined,
      notes: input.notes,
      number: input.occurrenceNumber,
      // A materialized occurrence is a future, unpaid row; it is paid later like any other (spec 034 FR 21).
      paid: card ? undefined : false,
      recurrenceId: series.id,
      tags: input.tags,
      value: input.value,
    });

    if (!card) {
      return { overLimit: false, transaction };
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });

    return { overLimit: data.invoices.used > card.limit, transaction };
  }
}
