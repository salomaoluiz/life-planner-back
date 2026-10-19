import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';

import {
  UpdateRecurrenceInput,
  UpdateRecurrenceSchema,
} from '@finance/application/dto/UpdateRecurrence';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import { AccountStatus, RecurrenceStatus } from '@finance/domain/enum';
import {
  IFinanceAccountRepository,
  IFinanceCreditCardRepository,
  IFinanceRecurrenceRepository,
  SeriesPatchRepositoryParams,
} from '@finance/domain/repository';
import { occurrenceDate } from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 034 scope ALL (FR 20, 23, 25).
export class UpdateRecurrenceUseCase implements UseCaseWithParams<
  UpdateRecurrenceInput,
  RecurrenceEntity
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureTransactionConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: UpdateRecurrenceInput): Promise<RecurrenceEntity> {
    const input = validate(UpdateRecurrenceSchema, params);
    const series = await this.recurrenceRepository.findById(input.id);

    if (!series || !hasOwnerAccess(input.accessibleOwners, series)) {
      throw new NotFoundException();
    }

    if (input.categoryId !== undefined) {
      await this.ensureTransactionConsistencyUseCase.execute({
        accessibleOwners: input.accessibleOwners,
        accountId: series.accountId ?? undefined,
        blockArchivedAccount: false,
        categoryId: input.categoryId,
        creditCardId: series.creditCardId ?? undefined,
        owner: series.owner,
        ownerId: series.ownerId,
        type: series.type,
      });
    }

    const seriesPatch: SeriesPatchRepositoryParams = {
      categoryId: input.categoryId,
      description: input.description,
      value: input.value,
    };
    let deleteAfter: null | string | undefined;

    if (input.endDate !== undefined) {
      if (input.endDate !== null && input.endDate < series.startDate) {
        throw new BadRequestException('endDate must not be before the first date');
      }

      Object.assign(seriesPatch, await this.endDatePatch(series, input.endDate));
      deleteAfter = input.endDate;
    }

    await this.recurrenceRepository.applyChange({
      deleteAfter,
      fromNumber: series.firstNumber,
      rowPatch: {
        categoryId: input.categoryId,
        description: input.description,
        value: input.value,
      },
      seriesPatch,
      sourceId: series.id,
    });

    return (await this.recurrenceRepository.findById(series.id)) as RecurrenceEntity;
  }

  // The series restarts (or ends) by the schedule; a series ended because its source was archived stays ended.
  private async endDatePatch(
    series: RecurrenceEntity,
    endDate: null | string,
  ): Promise<SeriesPatchRepositoryParams> {
    const rule = { ...series, endDate };
    const next = occurrenceDate(rule, series.lastGeneratedNumber + 1);
    const reached = endDate !== null && next > endDate;

    if (
      !reached &&
      series.status === RecurrenceStatus.ENDED &&
      (await this.sourceArchived(series))
    ) {
      return { endDate };
    }

    return {
      endDate,
      nextOccurrenceDate: reached ? null : next,
      status: reached ? RecurrenceStatus.ENDED : RecurrenceStatus.ACTIVE,
    };
  }

  private async sourceArchived(series: RecurrenceEntity): Promise<boolean> {
    const source = series.accountId
      ? await this.accountRepository.findAccountById(series.accountId)
      : await this.creditCardRepository.findCreditCardById(series.creditCardId as string);

    return source?.status === AccountStatus.ARCHIVED;
  }
}
