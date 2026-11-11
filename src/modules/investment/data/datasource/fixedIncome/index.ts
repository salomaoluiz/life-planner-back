import { InvestmentFixedIncomeRateMode, Prisma } from '@db/client';
import {
  FixedIncomeRateWrite,
  FixedIncomeTermsWrite,
} from '@investment/domain/entity/FixedIncomeEntity';
import {
  InvestmentFixedIncomeRedemptionKind,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { FixedIncomeRedemptionTooLargeError } from '@investment/domain/error/FixedIncomeRedemptionTooLargeError';
import { calculateTitle } from '@investment/domain/service/FixedIncomeCalculator';
import { Decimal8, roundDiv } from '@shared/infra/decimal';

const CENT_SCALE = 10n ** 6n;

// Spec 105 FR 3-5: the three tables of a calculated title are written by the calling transaction; every write ends
// with `recalculateFixedIncome` so the derived columns of the redemptions never go stale (FR 21).
export async function deleteAdjustment(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.investmentFixedIncomeAdjustment.deleteMany({ where: { id } });
}
export async function deleteRate(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.investmentFixedIncomeRate.deleteMany({ where: { id } });
}
export async function insertRate(
  tx: Prisma.TransactionClient,
  assetId: string,
  rate: FixedIncomeRateWrite,
): Promise<void> {
  await tx.investmentFixedIncomeRate.create({ data: { asset_id: assetId, ...rateColumns(rate) } });
}
// FR 4: manual BUYs become lots, SELLs become partial redemptions of what they paid, valuations are dropped.
export async function convertManualOperations(
  tx: Prisma.TransactionClient,
  assetId: string,
): Promise<void> {
  const sells = await tx.investmentOperation.findMany({
    select: { id: true, total: true },
    where: { asset_id: assetId, type: InvestmentOperationType.SELL },
  });

  for (const sell of sells) {
    await tx.investmentOperation.update({
      data: {
        net_amount: sell.total,
        redemption_kind: InvestmentFixedIncomeRedemptionKind.PARTIAL,
      },
      where: { id: sell.id },
    });
  }

  await tx.investmentValuation.deleteMany({ where: { asset_id: assetId } });
}
export async function recalculateFixedIncome(
  tx: Prisma.TransactionClient,
  assetId: string,
): Promise<void> {
  const terms = await tx.investmentFixedIncomeTerms.findUnique({ where: { asset_id: assetId } });

  if (!terms) {
    return;
  }

  const rates = await tx.investmentFixedIncomeRate.findMany({ where: { asset_id: assetId } });
  const adjustments = await tx.investmentFixedIncomeAdjustment.findMany({
    where: { asset_id: assetId },
  });
  const operations = await tx.investmentOperation.findMany({
    orderBy: [{ date: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
    select: {
      date: true,
      id: true,
      net_amount: true,
      quantity: true,
      redemption_kind: true,
      type: true,
    },
    where: { asset_id: assetId },
  });
  const maturityDate = day(terms.maturity_date);
  const netAmounts = new Map<string, number>();
  const result = calculateTitle({
    adjustments: adjustments.map((row) => ({ date: day(row.date), grossAmount: row.gross_amount })),
    lots: operations
      .filter((row) => row.type === InvestmentOperationType.BUY)
      .map((row) => ({
        date: day(row.date),
        operationId: row.id,
        principal: row.quantity ? centsOf(row.quantity) : 0,
      })),
    on: maturityDate,
    rates: rates.map((row) => ({
      effectiveRate: Number(row.effective_rate),
      startDate: day(row.start_date),
    })),
    redemptions: operations
      .filter((row) => row.type === InvestmentOperationType.SELL)
      .map((row) => {
        netAmounts.set(row.id, row.net_amount ?? 0);

        return {
          date: day(row.date),
          kind:
            row.redemption_kind === InvestmentFixedIncomeRedemptionKind.TOTAL
              ? InvestmentFixedIncomeRedemptionKind.TOTAL
              : InvestmentFixedIncomeRedemptionKind.PARTIAL,
          netAmount: row.net_amount ?? 0,
          operationId: row.id,
        };
      }),
    terms: { maturityDate, taxExempt: terms.tax_exempt },
  });

  if (result.error) {
    throw new FixedIncomeRedemptionTooLargeError(result.error.date, result.error.operationId);
  }

  for (const [operationId, redemption] of result.redemptions) {
    const fees = [
      { amount: redemption.ir, kind: 'INCOME_TAX' as const },
      { amount: redemption.iof, kind: 'IOF' as const },
    ].filter((fee) => fee.amount > 0);

    await tx.investmentOperation.update({
      data: {
        fees: { create: fees.map((fee) => ({ ...fee, description: null })), deleteMany: {} },
        fees_total: redemption.ir + redemption.iof,
        gross: redemption.gross,
        quantity: reais(redemption.principalUsed),
        total: netAmounts.get(operationId) ?? 0,
        unit_price: Decimal8.fromScaled(
          roundDiv(
            BigInt(redemption.gross) * 10n ** 8n,
            BigInt(Math.max(1, redemption.principalUsed)),
          ),
        ).toFixed8(),
      },
      where: { id: operationId },
    });
  }
}
export async function replaceRate(
  tx: Prisma.TransactionClient,
  id: string,
  rate: FixedIncomeRateWrite,
): Promise<void> {
  await tx.investmentFixedIncomeRate.update({ data: rateColumns(rate), where: { id } });
}
export async function saveAdjustment(
  tx: Prisma.TransactionClient,
  assetId: string,
  date: string,
  grossAmount: number,
): Promise<void> {
  const calendar = new Date(`${date}T00:00:00.000Z`);

  await tx.investmentFixedIncomeAdjustment.upsert({
    create: { asset_id: assetId, date: calendar, gross_amount: grossAmount },
    update: { gross_amount: grossAmount },
    where: { asset_id_date: { asset_id: assetId, date: calendar } },
  });
}
export async function saveTerms(
  tx: Prisma.TransactionClient,
  assetId: string,
  terms: FixedIncomeTermsWrite,
): Promise<void> {
  const data = {
    liquidity: terms.liquidity,
    liquidity_date: terms.liquidityDate ? new Date(`${terms.liquidityDate}T00:00:00.000Z`) : null,
    maturity_date: new Date(`${terms.maturityDate}T00:00:00.000Z`),
    product: terms.product,
    tax_exempt: terms.taxExempt,
  };

  await tx.investmentFixedIncomeTerms.upsert({
    create: { asset_id: assetId, ...data },
    update: data,
    where: { asset_id: assetId },
  });
}

function centsOf(quantity: { toFixed(places: number): string }): number {
  return Number(roundDiv(Decimal8.parse(quantity.toFixed(8)).scaled, CENT_SCALE));
}
function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}
function rateColumns(rate: FixedIncomeRateWrite) {
  return {
    annual_rate: rate.annualRate,
    cdi_percent: rate.cdiPercent,
    effective_rate: rate.effectiveRate,
    index_rate: rate.indexRate,
    mode: rate.mode as InvestmentFixedIncomeRateMode,
    spread: rate.spread,
    start_date: new Date(`${rate.startDate}T00:00:00.000Z`),
  };
}
// Cents of principal as the reais decimal string stored in `quantity` (FR 13).
function reais(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
