import { Injectable, NotFoundException } from '@nestjs/common';

import { InvestmentIncomeSeries, Prisma } from '@db/client';
import {
  applyDeltas,
  LINKED_SELECT,
  lockAccounts,
  lockAsset,
  reversalDeltas,
} from '@investment/data/datasource/financeLink';
import { writeIncomeIn } from '@investment/data/datasource/IncomeDatasource';
import {
  deletePlannedIn,
  insertOccurrencesIn,
  lockSeries,
} from '@investment/data/datasource/incomeSeries';
import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import { toOwnerWhere } from '@investment/data/datasource/mapper/OwnerWhere';
import {
  CreateSeriesParams,
  OccurrenceInsert,
  PlannedRewrite,
  SeriesPatch,
} from '@investment/domain/entity/IncomeSeriesEntity';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IncomeSeriesEndReason, InvestmentIncomeType } from '@investment/domain/enum';
import { Database } from '@shared/infra/db/Database';

const date = InvestmentMapper.fromCalendarDate;

@Injectable()
export class IncomeSeriesDatasource {
  constructor(private readonly db: Database) {}

  async countOccurrences(seriesId: string): Promise<{ planned: number; received: number }> {
    const [received, planned] = await Promise.all([
      this.db.client.investmentIncome.count({ where: { received: true, series_id: seriesId } }),
      this.db.client.investmentIncome.count({ where: { received: false, series_id: seriesId } }),
    ]);

    return { planned, received };
  }

  async createSeries(params: CreateSeriesParams): Promise<string> {
    return this.db.client.$transaction(async (tx) => createSeriesIn(tx, params));
  }

  async deleteSeries(id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const series = await tx.investmentIncomeSeries.findUnique({ where: { id } });

      if (!series) {
        return;
      }

      await lockAsset(tx, series.asset_id);
      await lockSeries(tx, id);

      const incomes = await tx.investmentIncome.findMany({
        select: { transaction: { select: LINKED_SELECT }, transaction_id: true },
        where: { series_id: id, transaction_id: { not: null } },
      });
      const paid = incomes.flatMap((income) =>
        income.transaction?.paid && income.transaction.account_id
          ? [
              {
                accountId: income.transaction.account_id,
                type: 'INCOME' as const,
                value: income.transaction.value,
              },
            ]
          : [],
      );

      await lockAccounts(
        tx,
        incomes.flatMap((income) =>
          income.transaction?.account_id ? [income.transaction.account_id] : [],
        ),
      );
      await tx.investmentIncomeSeries.delete({ where: { id } });
      await tx.financialTransaction.deleteMany({
        where: {
          id: {
            in: incomes.map((income) => income.transaction_id).filter((v): v is string => !!v),
          },
        },
      });
      await applyDeltas(tx, reversalDeltas(paid));
    });
  }

  async endSeries(params: {
    deleteFromNumber?: number;
    endedAt: string;
    endReason: IncomeSeriesEndReason;
    id: string;
  }): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const series = await tx.investmentIncomeSeries.findUnique({ where: { id: params.id } });

      if (!series) {
        throw new NotFoundException('Series not found');
      }

      await lockAsset(tx, series.asset_id);
      await lockSeries(tx, params.id);

      if (params.deleteFromNumber !== undefined) {
        await deletePlannedIn(tx, params.id, params.deleteFromNumber);
      }

      await tx.investmentIncomeSeries.update({
        data: { end_reason: params.endReason, ended_at: date(params.endedAt) },
        where: { id: params.id },
      });
    });
  }

  async findActiveByOwners(owners: OwnerAccess[]): Promise<InvestmentIncomeSeries[]> {
    return this.db.client.investmentIncomeSeries.findMany({
      where: { asset: toOwnerWhere(owners), ended_at: null },
    });
  }

  async findAllActive(): Promise<InvestmentIncomeSeries[]> {
    return this.db.client.investmentIncomeSeries.findMany({ where: { ended_at: null } });
  }

  async findByAsset(assetId: string): Promise<InvestmentIncomeSeries[]> {
    return this.db.client.investmentIncomeSeries.findMany({
      orderBy: [
        { ended_at: { nulls: 'first', sort: 'asc' } },
        { created_at: 'desc' },
        { id: 'asc' },
      ],
      where: { asset_id: assetId },
    });
  }

  async findById(id: string): Promise<InvestmentIncomeSeries | null> {
    return this.db.client.investmentIncomeSeries.findUnique({ where: { id } });
  }

  async findPlannedFrom(seriesId: string, fromNumber: number) {
    const rows = await this.db.client.investmentIncome.findMany({
      orderBy: { occurrence_number: 'asc' },
      select: {
        ex_date: true,
        id: true,
        occurrence_number: true,
        payment_date: true,
        quantity: true,
      },
      where: { occurrence_number: { gte: fromNumber }, received: false, series_id: seriesId },
    });

    return rows.map((row) => ({
      exDate: InvestmentMapper.toCalendarDate(row.ex_date ?? row.payment_date),
      id: row.id,
      number: row.occurrence_number ?? 0,
      paymentDate: InvestmentMapper.toCalendarDate(row.payment_date),
      quantity: row.quantity ? row.quantity.toFixed(8) : '0',
    }));
  }

  // Idempotent: the series row is locked and the cursor is re-read, so a concurrent run inserts nothing twice.
  async materialize(params: {
    assetLabel: string;
    ended?: { endedAt: string; endReason: IncomeSeriesEndReason };
    lastGeneratedNumber: number;
    occurrences: OccurrenceInsert[];
    seriesId: string;
  }): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const series = await tx.investmentIncomeSeries.findUnique({ where: { id: params.seriesId } });

      if (!series) {
        return;
      }

      await lockAsset(tx, series.asset_id);
      await lockAccounts(tx, series.account_id ? [series.account_id] : []);
      await lockSeries(tx, params.seriesId);

      const current = await tx.investmentIncomeSeries.findUnique({
        select: { ended_at: true, last_generated_number: true },
        where: { id: params.seriesId },
      });

      if (
        !current ||
        current.ended_at ||
        (params.occurrences.length > 0 &&
          current.last_generated_number >= params.lastGeneratedNumber)
      ) {
        return;
      }

      await insertOccurrencesIn(tx, contextOf(series, params.assetLabel), params.occurrences);
      await tx.investmentIncomeSeries.update({
        data: {
          last_generated_number: params.lastGeneratedNumber,
          ...(params.ended
            ? { end_reason: params.ended.endReason, ended_at: date(params.ended.endedAt) }
            : {}),
        },
        where: { id: params.seriesId },
      });
    });
  }

  async splitSeries(params: {
    create: CreateSeriesParams;
    deleteFromNumber: number;
    endedAt: string;
    id: string;
  }): Promise<string> {
    return this.db.client.$transaction(async (tx) => {
      const series = await tx.investmentIncomeSeries.findUnique({ where: { id: params.id } });

      if (!series) {
        throw new NotFoundException('Series not found');
      }

      await lockAsset(tx, series.asset_id);
      await lockSeries(tx, params.id);
      await deletePlannedIn(tx, params.id, params.deleteFromNumber);
      await tx.investmentIncomeSeries.update({
        data: { end_reason: 'SPLIT', ended_at: date(params.endedAt) },
        where: { id: params.id },
      });

      return createSeriesIn(tx, params.create);
    });
  }

  async updateSeries(params: {
    assetLabel: string;
    patch: SeriesPatch;
    planned?: PlannedRewrite[];
    seriesId: string;
  }): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const before = await tx.investmentIncomeSeries.findUnique({ where: { id: params.seriesId } });

      if (!before) {
        throw new NotFoundException('Series not found');
      }

      await lockAsset(tx, before.asset_id);
      await lockSeries(tx, params.seriesId);

      const after = await tx.investmentIncomeSeries.update({
        data: toSeriesData(params.patch),
        where: { id: params.seriesId },
      });

      for (const rewrite of params.planned ?? []) {
        const income = await tx.investmentIncome.findUnique({ where: { id: rewrite.incomeId } });

        if (!income || income.received) {
          continue;
        }

        await writeIncomeIn(tx, {
          accountId: after.account_id,
          amountPerUnit: rewrite.amountPerUnit,
          assetId: after.asset_id,
          assetLabel: params.assetLabel,
          categoryId: after.category_id,
          createdBy: income.created_by,
          currency: income.currency,
          exDate: rewrite.exDate,
          incomeId: income.id,
          netAmount: rewrite.netAmount,
          notes: after.notes,
          paid: false,
          paymentDate: InvestmentMapper.toCalendarDate(income.payment_date),
          quantity: rewrite.quantity,
          type: InvestmentIncomeType[income.type],
          withFinance: after.with_finance,
        });
      }
    });
  }
}

function contextOf(series: InvestmentIncomeSeries, assetLabel: string) {
  return {
    accountId: series.account_id,
    amountPerUnit: series.amount_per_unit.toFixed(8),
    assetId: series.asset_id,
    assetLabel,
    categoryId: series.category_id,
    createdBy: series.created_by,
    currency: series.currency,
    notes: series.notes,
    seriesId: series.id,
    type: InvestmentIncomeType[series.type],
    withFinance: series.with_finance,
  };
}
async function createSeriesIn(
  tx: Prisma.TransactionClient,
  params: CreateSeriesParams,
): Promise<string> {
  const { series } = params;

  await lockAsset(tx, series.assetId);
  await lockAccounts(tx, series.accountId ? [series.accountId] : []);

  const created = await tx.investmentIncomeSeries.create({
    data: {
      account_id: series.accountId,
      amount_per_unit: series.amountPerUnit,
      asset_id: series.assetId,
      category_id: series.categoryId,
      created_by: series.createdBy,
      currency: series.currency,
      end_date: series.endDate ? date(series.endDate) : null,
      end_reason: series.endReason,
      ended_at: series.endedAt ? date(series.endedAt) : null,
      ex_date_offset_days: series.exDateOffsetDays,
      first_number: series.firstNumber,
      first_payment_date: date(series.firstPaymentDate),
      frequency_interval: series.frequency.interval,
      frequency_unit: series.frequency.unit,
      last_generated_number: series.lastGeneratedNumber,
      notes: series.notes,
      type: series.type,
      with_finance: series.withFinance,
    },
  });

  await insertOccurrencesIn(tx, contextOf(created, params.assetLabel), params.occurrences);

  return created.id;
}
function toSeriesData(patch: SeriesPatch): Prisma.InvestmentIncomeSeriesUncheckedUpdateInput {
  return {
    ...(patch.accountId !== undefined ? { account_id: patch.accountId } : {}),
    ...(patch.amountPerUnit !== undefined ? { amount_per_unit: patch.amountPerUnit } : {}),
    ...(patch.categoryId !== undefined ? { category_id: patch.categoryId } : {}),
    ...(patch.endDate !== undefined
      ? { end_date: patch.endDate ? date(patch.endDate) : null }
      : {}),
    ...(patch.endedAt !== undefined
      ? { ended_at: patch.endedAt ? date(patch.endedAt) : null }
      : {}),
    ...(patch.endReason !== undefined ? { end_reason: patch.endReason } : {}),
    ...(patch.lastGeneratedNumber !== undefined
      ? { last_generated_number: patch.lastGeneratedNumber }
      : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.withFinance !== undefined ? { with_finance: patch.withFinance } : {}),
  };
}
