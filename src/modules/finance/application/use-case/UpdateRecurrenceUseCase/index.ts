import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';

import {
  UpdateRecurrenceInput,
  UpdateRecurrenceSchema,
} from '@finance/application/dto/UpdateRecurrence';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import { RecurrenceStatus } from '@finance/domain/enum';
import {
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

    ensureOwnerWritable(input.accessibleOwners, series);

    if (input.categoryId !== undefined) {
      await this.ensureTransactionConsistencyUseCase.execute({
        accessibleOwners: input.accessibleOwners,
        accountId: series.accountId ?? undefined,
        blockArchivedAccount: false,
        blockArchivedCategory: input.categoryId !== series.categoryId,
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

      Object.assign(seriesPatch, this.endDatePatch(series, input.endDate));
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
      tags: input.tags,
    });

    return (await this.recurrenceRepository.findById(series.id)) as RecurrenceEntity;
  }

  // An ACTIVE series follows its new end date. An ENDED one never restarts: it ended because its source was archived
  // or because a split gave the rest of the numbering to another series (a restart would duplicate those occurrences).
  private endDatePatch(
    series: RecurrenceEntity,
    endDate: null | string,
  ): SeriesPatchRepositoryParams {
    if (series.status === RecurrenceStatus.ENDED) {
      return { endDate };
    }

    const rule = { ...series, endDate };
    const next = occurrenceDate(rule, series.lastGeneratedNumber + 1);
    const reached = endDate !== null && next > endDate;

    return {
      endDate,
      nextOccurrenceDate: reached ? null : next,
      status: reached ? RecurrenceStatus.ENDED : RecurrenceStatus.ACTIVE,
    };
  }
}
