import { Prisma } from '@db/client';
import { applyDeltas } from '@investment/data/datasource/financeLink';
import {
  InvestmentMapper,
  POSITION_SELECT,
} from '@investment/data/datasource/mapper/InvestmentMapper';
import { OccurrenceInsert } from '@investment/domain/entity/IncomeSeriesEntity';
import { InvestmentAssetClass, InvestmentIncomeType } from '@investment/domain/enum';
import { unitStepOf } from '@investment/domain/service/CorporateEventMath';
import {
  exDateOf,
  IncomeSeriesRule,
  MAX_OCCURRENCES_PER_CREATE,
  occurrenceDate,
} from '@investment/domain/service/IncomeSeriesSchedule';
import { suggestNet, withholdingBps } from '@investment/domain/service/IncomeWithholding';
import { calculatePosition } from '@investment/domain/service/PositionCalculator';
import { Decimal8 } from '@shared/infra/decimal';
import { uuidV4 } from '@shared/infra/uuid';

// Spec 086 pattern: one statement per 500 rows.
export const BATCH_SIZE = 500;

export interface SeriesRowContext {
  accountId: null | string;
  amountPerUnit: string;
  assetId: string;
  assetLabel: string;
  categoryId: null | string;
  createdBy: string;
  currency: string;
  notes: null | string;
  seriesId: string;
  type: InvestmentIncomeType;
  withFinance: boolean;
}

// Spec 115 FR 14, 18: the occurrences as real incomes (and finance rows when the series is in finance), batched.
// The ledger moves once with the sum of the received ones.
export async function insertOccurrencesIn(
  tx: Prisma.TransactionClient,
  context: SeriesRowContext,
  occurrences: OccurrenceInsert[],
): Promise<void> {
  if (occurrences.length === 0) {
    return;
  }

  const rowIds = new Map<number, string>();

  const { accountId, categoryId } = context;

  if (context.withFinance && accountId && categoryId) {
    const account = await tx.financialAccount.findUnique({
      select: { owner: true, owner_id: true },
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const rows = occurrences.map((occurrence) => {
      const id = uuidV4();

      rowIds.set(occurrence.number, id);

      return {
        account_id: accountId,
        category_id: categoryId,
        currency: context.currency,
        date: InvestmentMapper.fromCalendarDate(occurrence.paymentDate),
        description: context.assetLabel,
        external_lock: 'INVESTMENT' as const,
        id,
        notes: context.notes,
        owner: account.owner,
        owner_id: account.owner_id,
        paid: occurrence.received,
        type: 'INCOME' as const,
        value: occurrence.netAmount,
      };
    });

    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      await tx.financialTransaction.createMany({ data: rows.slice(index, index + BATCH_SIZE) });
    }

    const delta = occurrences.reduce(
      (sum, occurrence) => sum + (occurrence.received ? occurrence.netAmount : 0),
      0,
    );

    await applyDeltas(tx, delta === 0 ? [] : [{ accountId, delta }]);
  }

  const incomes = occurrences.map((occurrence) => ({
    amount_per_unit: context.amountPerUnit,
    asset_id: context.assetId,
    created_by: context.createdBy,
    currency: context.currency,
    ex_date: InvestmentMapper.fromCalendarDate(occurrence.exDate),
    net_amount: occurrence.netAmount,
    notes: context.notes,
    occurrence_number: occurrence.number,
    payment_date: InvestmentMapper.fromCalendarDate(occurrence.paymentDate),
    quantity: occurrence.quantity,
    received: occurrence.received,
    series_id: context.seriesId,
    transaction_id: rowIds.get(occurrence.number) ?? null,
    type: context.type,
  }));

  for (let index = 0; index < incomes.length; index += BATCH_SIZE) {
    await tx.investmentIncome.createMany({ data: incomes.slice(index, index + BATCH_SIZE) });
  }
}
export async function lockSeries(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "investment_income_series" WHERE "id" = ${id} FOR UPDATE`,
  );
}

// Deletes planned incomes (and their unpaid finance rows, so the ledger is untouched).
export async function deletePlannedIn(
  tx: Prisma.TransactionClient,
  seriesId: string,
  fromNumber: number,
): Promise<void> {
  const planned = await tx.investmentIncome.findMany({
    select: { id: true, transaction_id: true },
    where: { occurrence_number: { gte: fromNumber }, received: false, series_id: seriesId },
  });

  await deleteIncomesIn(tx, planned);
}

async function deleteIncomesIn(
  tx: Prisma.TransactionClient,
  incomes: { id: string; transaction_id: null | string }[],
): Promise<void> {
  if (incomes.length === 0) {
    return;
  }

  await tx.investmentIncome.deleteMany({
    where: { id: { in: incomes.map((income) => income.id) } },
  });

  const rowIds = incomes
    .map((income) => income.transaction_id)
    .filter((id): id is string => id !== null);

  if (rowIds.length > 0) {
    await tx.financialTransaction.deleteMany({ where: { id: { in: rowIds } } });
  }
}

// Spec 115 FR 11, 20: runs in the transaction of every operation write. The planned occurrences follow the position at
// their ex-date; the first one with no position ends the series (the planned ones from there are deleted). When no
// planned occurrence is left to tell, the next ones are walked until the position can no longer change.
export async function syncIncomeSeries(
  tx: Prisma.TransactionClient,
  assetId: string,
): Promise<void> {
  const seriesRows = await tx.investmentIncomeSeries.findMany({
    where: { asset_id: assetId, ended_at: null },
  });

  if (seriesRows.length === 0) {
    return;
  }

  const asset = await tx.investmentAsset.findUnique({
    select: { asset_class: true },
    where: { id: assetId },
  });
  const assetClass = InvestmentAssetClass[asset?.asset_class ?? 'PRIVATE'];
  const operations = (
    await tx.investmentOperation.findMany({ select: POSITION_SELECT, where: { asset_id: assetId } })
  ).map((row) => InvestmentMapper.toPositionOperation(row));
  const lastOperation = operations.reduce(
    (max, operation) => (operation.date > max ? operation.date : max),
    '',
  );
  const step = unitStepOf(assetClass);
  function positionAt(date: string): Decimal8 {
    return calculatePosition(
      operations.filter((operation) => operation.date <= date),
      { step },
    ).quantity;
  }

  for (const series of seriesRows) {
    const rate = withholdingBps(InvestmentIncomeType[series.type], assetClass);
    const amount = Decimal8.parse(series.amount_per_unit.toFixed(8));
    const planned = await tx.investmentIncome.findMany({
      orderBy: { occurrence_number: 'asc' },
      select: {
        ex_date: true,
        id: true,
        net_amount: true,
        occurrence_number: true,
        payment_date: true,
        quantity: true,
        transaction_id: true,
      },
      where: { received: false, series_id: series.id },
    });
    let endedAt: null | string = null;

    for (const [index, income] of planned.entries()) {
      const exDate = InvestmentMapper.toCalendarDate(income.ex_date ?? income.payment_date);
      const quantity = positionAt(exDate);

      if (quantity.isZero()) {
        endedAt = InvestmentMapper.toCalendarDate(income.payment_date);
        await deleteIncomesIn(tx, planned.slice(index));
        break;
      }

      const net = suggestNet(quantity, amount, rate);

      if (net !== income.net_amount || quantity.toFixed8() !== income.quantity?.toFixed(8)) {
        await tx.investmentIncome.update({
          data: { net_amount: net, quantity: quantity.toFixed8() },
          where: { id: income.id },
        });

        if (income.transaction_id) {
          await tx.financialTransaction.update({
            data: { value: net },
            where: { id: income.transaction_id },
          });
        }
      }
    }

    endedAt ??= firstFutureZero(series, lastOperation, positionAt);

    if (endedAt) {
      await tx.investmentIncomeSeries.update({
        data: { end_reason: 'POSITION_ZERO', ended_at: InvestmentMapper.fromCalendarDate(endedAt) },
        where: { id: series.id },
      });
    }
  }
}

function firstFutureZero(
  series: Prisma.InvestmentIncomeSeriesGetPayload<object>,
  lastOperation: string,
  positionAt: (date: string) => Decimal8,
): null | string {
  const rule: IncomeSeriesRule = {
    endDate: series.end_date ? InvestmentMapper.toCalendarDate(series.end_date) : null,
    exDateOffsetDays: series.ex_date_offset_days,
    firstNumber: series.first_number,
    firstPaymentDate: InvestmentMapper.toCalendarDate(series.first_payment_date),
    frequency: { interval: series.frequency_interval, unit: series.frequency_unit as never },
  };
  const start = series.last_generated_number - series.first_number + 2;

  for (let k = start; k < start + MAX_OCCURRENCES_PER_CREATE; k += 1) {
    const paymentDate = occurrenceDate(rule, k);

    if (rule.endDate && paymentDate > rule.endDate) {
      return null;
    }

    const exDate = exDateOf(paymentDate, rule.exDateOffsetDays);

    if (positionAt(exDate).isZero()) {
      return paymentDate;
    }
    if (exDate > lastOperation) {
      return null;
    }
  }

  return null;
}
