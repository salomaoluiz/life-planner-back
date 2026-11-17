import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  UpdateIncomeSeriesInput,
  UpdateIncomeSeriesSchema,
} from '@investment/application/dto/IncomeSeries';
import {
  incompleteError,
  normalizeIncomeNotes,
  resolveIncomeAccount,
  resolveIncomeCategory,
} from '@investment/application/service/IncomeRules';
import { IncomeSeriesGate } from '@investment/application/service/IncomeSeriesGate';
import {
  assertPositionAtStart,
  draftOf,
  IncomeSeriesView,
  planSeries,
  toSeriesView,
} from '@investment/application/service/IncomeSeriesRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import { IncomeSeriesEndReason } from '@investment/domain/enum';
import {
  IIncomeRepository,
  IIncomeSeriesRepository,
  IInvestmentRepository,
} from '@investment/domain/repository';
import { suggestNet, withholdingBps } from '@investment/domain/service/IncomeWithholding';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { Decimal8 } from '@shared/infra/decimal';
import { validate } from '@shared/infra/validation';

// Spec 115 FR 24 `ALL` and FR 26: edits the series header and every planned occurrence; an end date (or `null`) on a
// series ended by MANUAL, END_DATE or POSITION_ZERO reopens it from the next number.
export class UpdateIncomeSeriesUseCase implements UseCaseWithParams<
  UpdateIncomeSeriesInput,
  IncomeSeriesView
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
    @Inject('IIncomeSeriesRepository') private readonly seriesRepository: IIncomeSeriesRepository,
    @Inject(IncomeSeriesGate) private readonly gate: IncomeSeriesGate,
  ) {}

  async execute(params: UpdateIncomeSeriesInput): Promise<IncomeSeriesView> {
    const input = validate(UpdateIncomeSeriesSchema, params);
    const series = await this.seriesRepository.findById(input.id);

    if (!series) {
      throw new NotFoundException();
    }

    const asset = await loadWritableAsset(this.investment, series.assetId, input.accessibleOwners);
    const withFinance = input.withFinance ?? series.withFinance;
    const accountId = withFinance ? (input.accountId ?? series.accountId) : null;
    const categoryId = withFinance ? (input.categoryId ?? series.categoryId) : null;

    if (!withFinance && (input.accountId || input.categoryId)) {
      throw new UnprocessableEntityException(
        'Send withFinance: true to add an account and a category',
      );
    }
    if (withFinance && (!accountId || !categoryId)) {
      throw incompleteError([
        ...(accountId ? [] : ['accountId']),
        ...(categoryId ? [] : ['categoryId']),
      ]);
    }
    if (withFinance && accountId && categoryId) {
      const account = await resolveIncomeAccount(
        this.investment,
        input.accessibleOwners,
        accountId,
        asset.currency,
      );

      await resolveIncomeCategory(this.incomes, account, categoryId);
    }

    const amountPerUnit = input.amountPerUnit?.toString() ?? series.amountPerUnit;
    const notes = input.notes === undefined ? series.notes : normalizeIncomeNotes(input.notes);
    const endDate = input.endDate === undefined ? series.endDate : input.endDate;
    const reopen =
      series.endedAt !== null &&
      series.endReason !== IncomeSeriesEndReason.SPLIT &&
      input.endDate !== undefined;
    const today = todayInSaoPaulo();

    if (endDate && endDate < series.firstPaymentDate) {
      throw new UnprocessableEntityException('endDate must not be before firstPaymentDate');
    }

    // Planned occurrences follow the new amount per unit (net = quantity x amount x (1 - rate)).
    const rate = withholdingBps(series.type, asset.assetClass);
    const planned = await this.seriesRepository.findPlannedFrom(series.id, 0);
    const rewrites = planned.map((occurrence) => ({
      amountPerUnit,
      exDate: occurrence.exDate,
      incomeId: occurrence.id,
      netAmount: suggestNet(
        Decimal8.parse(occurrence.quantity),
        Decimal8.parse(amountPerUnit),
        rate,
      ),
      quantity: occurrence.quantity,
    }));

    const reopened = { ...series, endDate, endedAt: null, endReason: null };
    const draft = draftOf(reopened);
    const plan = reopen
      ? planSeries({
          afterNumber: series.lastGeneratedNumber,
          asset,
          draft,
          markPast: false,
          today,
        })
      : undefined;

    if (plan?.endsAt && plan.insert.length === 0) {
      // FR 26: the next occurrence has no position either.
      assertPositionAtStart(asset, { ...draft, firstPaymentDate: plan.endsAt });
    }

    await this.seriesRepository.updateSeries({
      assetLabel: asset.ticker ?? asset.name,
      patch: {
        accountId,
        amountPerUnit,
        categoryId,
        endDate,
        notes,
        withFinance,
        ...(reopen ? { endedAt: null, endReason: null } : {}),
      },
      planned: rewrites,
      seriesId: series.id,
    });

    if (plan) {
      await this.seriesRepository.materialize({
        assetLabel: asset.ticker ?? asset.name,
        ended: plan.ended,
        lastGeneratedNumber: plan.lastNumber,
        occurrences: plan.insert,
        seriesId: series.id,
      });
    }

    this.gate.invalidate(input.accessibleOwners.map((access) => access.ownerId));

    const saved = await this.seriesRepository.findById(series.id);

    if (!saved) {
      throw new NotFoundException();
    }

    return toSeriesView(saved);
  }
}
