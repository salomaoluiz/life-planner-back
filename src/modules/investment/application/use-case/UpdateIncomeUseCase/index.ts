import {
  BadRequestException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  UpdateIncomeInput,
  UpdateIncomeParsed,
  UpdateIncomeSchema,
} from '@investment/application/dto/Income';
import {
  assertIncomeAccountChangeable,
  draftFromIncome,
  IncomeView,
  incompleteError,
  loadIncome,
  normalizeIncomeNotes,
  persistIncome,
  resolveIncomeAccount,
  resolveIncomeCategory,
  toIncomeView,
} from '@investment/application/service/IncomeRules';
import { IncomeSeriesGate } from '@investment/application/service/IncomeSeriesGate';
import {
  assertFrequencyAllowed,
  assertPositionAtStart,
  planSeries,
} from '@investment/application/service/IncomeSeriesRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { IncomeEntity } from '@investment/domain/entity/IncomeEntity';
import { IncomeSeriesEntity } from '@investment/domain/entity/IncomeSeriesEntity';
import {
  IIncomeRepository,
  IIncomeSeriesRepository,
  IInvestmentRepository,
} from '@investment/domain/repository';
import { occurrenceDate } from '@investment/domain/service/IncomeSeriesSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

import { UpdateIncomeSeriesUseCase } from '../UpdateIncomeSeriesUseCase';

// Spec 107 FR 13, 20: every create field can change; a new account moves the row and both ledgers in one transaction.
// Spec 115 FR 24: an income of a series is edited with a `scope`.
export class UpdateIncomeUseCase implements UseCaseWithParams<UpdateIncomeInput, IncomeView> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
    @Inject('IIncomeSeriesRepository') private readonly seriesRepository: IIncomeSeriesRepository,
    @Inject(IncomeSeriesGate) private readonly gate: IncomeSeriesGate,
    @Inject(UpdateIncomeSeriesUseCase)
    private readonly updateSeriesUseCase: UpdateIncomeSeriesUseCase,
  ) {}

  async execute(params: UpdateIncomeInput): Promise<IncomeView> {
    const input = validate(UpdateIncomeSchema, params);
    const { income } = await loadIncome(
      this.incomes,
      this.investment,
      input.id,
      input.accessibleOwners,
    );
    const asset = await loadWritableAsset(this.investment, income.assetId, input.accessibleOwners);
    const hasSeriesFields =
      input.frequency !== undefined ||
      input.exDateOffsetDays !== undefined ||
      input.endDate !== undefined;

    if (!income.seriesId) {
      if (hasSeriesFields) {
        throw new BadRequestException('Series fields need an income of a series');
      }

      return this.updateOne(input, income, asset);
    }
    if (!input.scope) {
      throw new BadRequestException('scope is required to edit an income of a series');
    }
    if (input.scope === 'ONLY_THIS') {
      if (hasSeriesFields) {
        throw new BadRequestException('Series fields need the scope THIS_AND_NEXT');
      }

      return this.updateOne(input, income, asset);
    }

    const series = await this.seriesRepository.findById(income.seriesId);

    if (!series) {
      throw new NotFoundException();
    }

    await assertIncomeAccountChangeable(this.investment, input.accessibleOwners, income.accountId);

    return input.scope === 'ALL'
      ? this.updateAll(input, income, series)
      : this.updateThisAndNext(input, income, series, asset);
  }

  private async reload(id: string): Promise<IncomeView> {
    const income = await this.incomes.findIncomeById(id);

    if (!income) {
      throw new NotFoundException();
    }

    return toIncomeView(income);
  }

  private async updateAll(
    input: UpdateIncomeParsed,
    income: IncomeEntity,
    series: IncomeSeriesEntity,
  ): Promise<IncomeView> {
    // Frequency, first date and offset change only with THIS_AND_NEXT (034 rule).
    if (input.frequency !== undefined || input.exDateOffsetDays !== undefined) {
      throw new BadRequestException('Frequency and ex-date offset change only with THIS_AND_NEXT');
    }

    await this.updateSeriesUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      accountId: input.accountId,
      amountPerUnit: input.amountPerUnit?.toString(),
      categoryId: input.categoryId,
      endDate: input.endDate,
      id: series.id,
      notes: input.notes,
      userId: input.userId,
      withFinance: input.withFinance,
    });

    return this.reload(income.id);
  }

  private async updateOne(
    input: UpdateIncomeParsed,
    income: IncomeEntity,
    asset: AssetDetail,
  ): Promise<IncomeView> {
    await assertIncomeAccountChangeable(this.investment, input.accessibleOwners, income.accountId);

    if (!(input.withFinance ?? income.withFinance) && (input.accountId || input.categoryId)) {
      throw new BadRequestException('Send withFinance: true to add an account and a category');
    }

    const current = draftFromIncome(income, input.userId, {
      accountId: input.accountId,
      categoryId: input.categoryId,
      withFinance: input.withFinance,
    });

    return persistIncome(this.incomes, this.investment, input.accessibleOwners, asset, {
      ...current,
      accountId: current.accountId,
      amountPerUnit:
        input.amountPerUnit === undefined ? current.amountPerUnit : input.amountPerUnit,
      categoryId: current.categoryId,
      exDate: input.exDate === undefined ? current.exDate : input.exDate,
      netAmount: input.netAmount ?? current.netAmount,
      notes: input.notes === undefined ? current.notes : input.notes,
      paymentDate: input.paymentDate ?? current.paymentDate,
      quantity: input.quantity === undefined ? current.quantity : input.quantity,
      status: input.status ?? current.status,
      type: input.type ?? current.type,
    });
  }

  private async updateThisAndNext(
    input: UpdateIncomeParsed,
    income: IncomeEntity,
    series: IncomeSeriesEntity,
    asset: AssetDetail,
  ): Promise<IncomeView> {
    const frequency = input.frequency ?? series.frequency;
    const withFinance = input.withFinance ?? series.withFinance;
    const accountId = withFinance ? (input.accountId ?? series.accountId) : null;
    const categoryId = withFinance ? (input.categoryId ?? series.categoryId) : null;

    assertFrequencyAllowed(frequency);

    if (!withFinance && (input.accountId || input.categoryId)) {
      throw new BadRequestException('Send withFinance: true to add an account and a category');
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

    // FR 24: a received occurrence stays with the old series; the new one starts at the next number.
    const received = income.paid;
    const number = (income.occurrenceNumber ?? 0) + (received ? 1 : 0);
    const oldRule = {
      exDateOffsetDays: series.exDateOffsetDays,
      firstNumber: series.firstNumber,
      firstPaymentDate: series.firstPaymentDate,
      frequency: series.frequency,
    };
    const firstPaymentDate = received
      ? occurrenceDate(oldRule, number - series.firstNumber + 1)
      : (input.paymentDate ?? income.paymentDate);
    const draft = {
      amountPerUnit: input.amountPerUnit?.toString() ?? series.amountPerUnit,
      endDate: input.endDate === undefined ? series.endDate : input.endDate,
      exDateOffsetDays:
        input.exDateOffsetDays === undefined ? series.exDateOffsetDays : input.exDateOffsetDays,
      firstNumber: number,
      firstPaymentDate,
      frequency,
      type: input.type ?? series.type,
    };

    assertPositionAtStart(asset, draft);

    const plan = planSeries({
      afterNumber: number - 1,
      asset,
      draft,
      markPast: false,
      today: todayInSaoPaulo(),
    });

    if (plan.insert.length === 0) {
      throw new UnprocessableEntityException('The new series has no occurrence up to this month');
    }

    const newId = await this.seriesRepository.splitSeries({
      create: {
        assetLabel: asset.ticker ?? asset.name,
        occurrences: plan.insert,
        series: {
          accountId,
          amountPerUnit: draft.amountPerUnit,
          assetId: asset.id,
          categoryId,
          createdBy: input.userId,
          currency: asset.currency,
          endDate: draft.endDate,
          endedAt: plan.ended?.endedAt ?? null,
          endReason: plan.ended?.endReason ?? null,
          exDateOffsetDays: draft.exDateOffsetDays,
          firstNumber: number,
          firstPaymentDate,
          frequency,
          lastGeneratedNumber: plan.lastNumber,
          notes: input.notes === undefined ? series.notes : normalizeIncomeNotes(input.notes),
          type: draft.type,
          withFinance,
        },
      },
      deleteFromNumber: number,
      endedAt: income.paymentDate,
      id: series.id,
    });

    this.gate.invalidate(input.accessibleOwners.map((access) => access.ownerId));

    const created = (
      await this.incomes.findIncomes({
        assetId: asset.id,
        from: plan.insert[0].paymentDate,
        limit: 50,
        owners: [],
        to: plan.insert[0].paymentDate,
      })
    ).find((item) => item.seriesId === newId);

    if (!created) {
      throw new NotFoundException();
    }

    return toIncomeView(created);
  }
}
