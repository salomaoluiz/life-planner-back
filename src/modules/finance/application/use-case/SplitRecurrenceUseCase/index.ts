import {
  BadRequestException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  SplitRecurrenceInput,
  SplitRecurrenceSchema,
} from '@finance/application/dto/UpdateRecurrence';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { RecurrenceStatus } from '@finance/domain/enum';
import {
  IFinanceInvoicePaymentRepository,
  IFinanceRecurrenceRepository,
  NewSeriesRepositoryParams,
  RowPatchRepositoryParams,
  SeriesPatchRepositoryParams,
} from '@finance/domain/repository';
import { firstUnpaidInvoiceMonth, invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import {
  lastDayOfMonth,
  occurrenceDate,
  planMaterialization,
  toOccurrenceRows,
} from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface SplitRecurrenceResult {
  // The series that now stops before the split; null when the split was at occurrence 1 (the series itself changed).
  ended: null | RecurrenceEntity;
  occurrences: TransactionEntity[];
  recurrence: RecurrenceEntity;
}

// Spec 034 scope THIS_AND_NEXT (FR 22): the old series ends at k-1, a new one starts at k with the new template.
export class SplitRecurrenceUseCase implements UseCaseWithParams<
  SplitRecurrenceInput,
  SplitRecurrenceResult
> {
  constructor(
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureTransactionConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject('IFinanceInvoicePaymentRepository')
    private readonly invoicePaymentRepository: IFinanceInvoicePaymentRepository,
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
  ) {}

  async execute(params: SplitRecurrenceInput): Promise<SplitRecurrenceResult> {
    const input = validate(SplitRecurrenceSchema, params);
    const series = await this.recurrenceRepository.findById(input.id);

    if (!series || !hasOwnerAccess(input.accessibleOwners, series)) {
      throw new NotFoundException();
    }

    if (
      (input.accountId !== undefined && series.accountId === null) ||
      (input.creditCardId !== undefined && series.creditCardId === null)
    ) {
      throw new UnprocessableEntityException('Cannot change between account and card');
    }

    const k = input.occurrenceNumber - series.firstNumber + 1;
    const splitDate = k >= 1 ? occurrenceDate(series, k) : undefined;

    if (splitDate === undefined || (series.endDate && splitDate > series.endDate)) {
      throw new BadRequestException('occurrenceNumber is not part of the series');
    }

    const target = {
      accountId: input.accountId ?? series.accountId ?? undefined,
      categoryId: input.categoryId ?? series.categoryId,
      creditCardId: input.creditCardId ?? series.creditCardId ?? undefined,
      description: input.description ?? series.description,
      endDate: input.endDate === undefined ? series.endDate : input.endDate,
      frequency: input.frequency ?? series.frequency,
      value: input.value ?? series.value,
    };

    if (target.endDate !== null && target.endDate < splitDate) {
      throw new BadRequestException('endDate must not be before the first date');
    }

    const sourceChanged =
      (input.accountId !== undefined && input.accountId !== series.accountId) ||
      (input.creditCardId !== undefined && input.creditCardId !== series.creditCardId);
    const { card } = await this.ensureTransactionConsistencyUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      accountId: target.accountId,
      blockArchivedAccount: sourceChanged,
      categoryId: target.categoryId,
      creditCardId: target.creditCardId,
      owner: series.owner,
      ownerId: series.ownerId,
      type: series.type,
    });

    const rule = { endDate: target.endDate, frequency: target.frequency, startDate: splitDate };
    const frequencyChanged = target.frequency !== series.frequency;
    const inPlace = k === 1;
    // Rows of the series from the split on, in the position of the new series.
    const generated = Math.max(0, series.lastGeneratedNumber - k + 1);
    const state = frequencyChanged
      ? planMaterialization({
          firstNumber: input.occurrenceNumber,
          horizon: lastDayOfMonth(input.today),
          lastGeneratedNumber: 0,
          rule,
          skippedNumbers: [],
        })
      : {
          ...nextState(rule, generated),
          occurrences: [],
        };
    const lastGeneratedNumber = frequencyChanged ? state.lastGeneratedNumber : generated;
    const skippedNumbers = frequencyChanged
      ? []
      : series.skippedNumbers.filter((number) => number >= input.occurrenceNumber);

    const rowPatch = await this.rowPatch(input, series, card);
    const replaceRows = frequencyChanged
      ? toOccurrenceRows(
          state.occurrences,
          card
            ? { closingDay: card.closingDay, paidMonths: await this.paidMonths(card.id) }
            : undefined,
        )
      : null;
    const common = {
      categoryId: target.categoryId,
      description: target.description,
      value: target.value,
    };
    const sourceFields =
      target.accountId === undefined
        ? { creditCardId: target.creditCardId }
        : { accountId: target.accountId };

    const sourceId = series.id;
    let seriesPatch: SeriesPatchRepositoryParams;
    let newSeries: NewSeriesRepositoryParams | null = null;

    if (inPlace) {
      seriesPatch = {
        ...common,
        ...sourceFields,
        endDate: target.endDate,
        frequency: target.frequency,
        lastGeneratedNumber,
        nextOccurrenceDate: state.nextOccurrenceDate,
        skippedNumbers,
        status: state.status,
      };
    } else {
      newSeries = {
        ...common,
        ...sourceFields,
        endDate: target.endDate,
        firstNumber: input.occurrenceNumber,
        frequency: target.frequency,
        lastGeneratedNumber,
        nextOccurrenceDate: state.nextOccurrenceDate,
        owner: series.owner,
        ownerId: series.ownerId,
        skippedNumbers,
        startDate: splitDate,
        status: state.status,
        type: series.type,
      };
      seriesPatch = {
        endDate: occurrenceDate(series, k - 1),
        lastGeneratedNumber: Math.min(series.lastGeneratedNumber, k - 1),
        nextOccurrenceDate: null,
        skippedNumbers: series.skippedNumbers.filter((number) => number < input.occurrenceNumber),
        status: RecurrenceStatus.ENDED,
      };
    }

    const targetId = await this.recurrenceRepository.applyChange({
      deleteAfter: input.endDate,
      fromNumber: input.occurrenceNumber,
      newSeries,
      replaceRows,
      rowPatch: {
        ...rowPatch,
        categoryId: input.categoryId,
        description: input.description,
        value: input.value,
      },
      seriesPatch,
      sourceId,
    });

    const [recurrence, ended, occurrences] = await Promise.all([
      this.recurrenceRepository.findById(targetId) as Promise<RecurrenceEntity>,
      inPlace ? null : this.recurrenceRepository.findById(series.id),
      this.recurrenceRepository.findOccurrences(targetId),
    ]);

    return { ended: ended ?? null, occurrences, recurrence };
  }

  private async paidMonths(cardId: string): Promise<Set<string>> {
    const payments = await this.invoicePaymentRepository.findByCardIds([cardId]);

    return new Set(payments.map((payment) => payment.invoiceMonth));
  }

  // A card change recomputes the invoice of each card row that is not in a paid invoice (FR 23).
  private async rowPatch(
    input: { accountId?: string; creditCardId?: string; occurrenceNumber: number },
    series: RecurrenceEntity,
    card: CreditCardEntity | undefined,
  ): Promise<RowPatchRepositoryParams> {
    const patch: RowPatchRepositoryParams = {
      accountId: input.accountId,
      creditCardId: input.creditCardId,
    };

    if (!card || input.creditCardId === undefined || input.creditCardId === series.creditCardId) {
      return patch;
    }

    const paidMonths = await this.paidMonths(card.id);
    const rows = await this.recurrenceRepository.findOccurrences(series.id);

    patch.invoiceMonths = rows
      .filter((row) => (row.occurrenceNumber as number) >= input.occurrenceNumber)
      .map((row) => ({
        id: row.id,
        invoiceMonth: firstUnpaidInvoiceMonth(
          invoiceMonthOf(row.date, card.closingDay),
          paidMonths,
        ),
      }));

    return patch;
  }
}

// Without a frequency change the series keeps its generated rows: only the next date and status follow the end date.
function nextState(
  rule: { endDate: null | string; frequency: RecurrenceEntity['frequency']; startDate: string },
  generated: number,
): { lastGeneratedNumber: number; nextOccurrenceDate: null | string; status: RecurrenceStatus } {
  const next = occurrenceDate(rule, generated + 1);
  const ended = rule.endDate !== null && next > rule.endDate;

  return {
    lastGeneratedNumber: generated,
    nextOccurrenceDate: ended ? null : next,
    status: ended ? RecurrenceStatus.ENDED : RecurrenceStatus.ACTIVE,
  };
}
