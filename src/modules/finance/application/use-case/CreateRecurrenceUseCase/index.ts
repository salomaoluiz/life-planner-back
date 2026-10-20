import { ForbiddenException, Inject, UnprocessableEntityException } from '@nestjs/common';

import {
  CreateRecurrenceInput,
  CreateRecurrenceSchema,
} from '@finance/application/dto/CreateRecurrence';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { IFinanceRecurrenceRepository } from '@finance/domain/repository';
import {
  lastDayOfMonth,
  planMaterialization,
  toOccurrenceRows,
} from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface RecurrenceWithOccurrences {
  occurrences: TransactionEntity[];
  overLimit: boolean;
  recurrence: RecurrenceEntity;
}

export class CreateRecurrenceUseCase implements UseCaseWithParams<
  CreateRecurrenceInput,
  RecurrenceWithOccurrences
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureTransactionConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: CreateRecurrenceInput): Promise<RecurrenceWithOccurrences> {
    const input = validate(CreateRecurrenceSchema, params);

    if (!hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    ensureOwnerWritable(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId });

    if (input.creditCardId !== undefined && input.paid !== undefined) {
      throw new UnprocessableEntityException('Card purchases follow their invoice');
    }

    const { account, card } = await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      accountId: input.accountId,
      blockArchivedAccount: true,
      blockArchivedCategory: true,
      categoryId: input.categoryId,
      creditCardId: input.creditCardId,
      currency: input.currency,
      owner: input.owner,
      ownerId: input.ownerId,
      type: input.type,
    });

    const rule = { endDate: input.endDate, frequency: input.frequency, startDate: input.date };
    const plan = planMaterialization({
      firstNumber: 1,
      horizon: lastDayOfMonth(input.today),
      lastGeneratedNumber: 0,
      rule,
      skippedNumbers: [],
    });

    // A new series on an invoice that is already paid is refused by the write (like any purchase).
    const rows = toOccurrenceRows(
      plan.occurrences,
      card ? { closingDay: card.closingDay, paidMonths: new Set() } : undefined,
      input.paid ?? input.date <= input.today,
    );

    const id = await this.recurrenceRepository.create({
      accountId: input.accountId,
      categoryId: input.categoryId,
      creditCardId: input.creditCardId,
      currency: (card ?? (account as AccountEntity)).currency,
      description: input.description,
      endDate: input.endDate,
      frequency: input.frequency,
      lastGeneratedNumber: plan.lastGeneratedNumber,
      nextOccurrenceDate: plan.nextOccurrenceDate,
      owner: input.owner,
      ownerId: input.ownerId,
      rows,
      startDate: input.date,
      status: plan.status,
      type: input.type,
      value: input.value,
    });

    const [recurrence, occurrences] = await Promise.all([
      this.recurrenceRepository.findById(id) as Promise<RecurrenceEntity>,
      this.recurrenceRepository.findOccurrences(id),
    ]);

    if (!card) {
      return { occurrences, overLimit: false, recurrence };
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });

    return { occurrences, overLimit: data.invoices.used > card.limit, recurrence };
  }
}
