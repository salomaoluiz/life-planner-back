import {
  day,
  INVESTMENT,
  names,
  ownerRef,
  SnapshotReader,
} from '@activity/data/datasource/ActivitySnapshotDatasource/helpers';
import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityEntityType, ActivityModule } from '@activity/domain/enum';
import { PrismaClient } from '@db/client';

async function asset(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.investmentAsset.findUnique({ where: { id } });

  if (!row) {
    return null;
  }

  return {
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.ASSET,
    fields: {
      archived: row.status !== 'ACTIVE',
      assetClass: row.asset_class,
      name: row.name,
      ticker: row.ticker,
    },
    label: row.ticker ?? row.name,
    modules: INVESTMENT,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
  };
}
async function operation(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.investmentOperation.findUnique({
    include: { account: true, asset: true },
    where: { id },
  });

  if (!row) {
    return null;
  }

  const total = row.total ?? row.net_amount ?? undefined;

  return {
    amountCents: operationAmount(row.type, total),
    bookingDate: day(row.date),
    currency: row.asset.currency,
    entityId: row.id,
    entityType: ActivityEntityType.OPERATION,
    extra: {
      operationType: row.type,
      quantity: row.quantity?.toString(),
      unitPrice: row.unit_price?.toString(),
    },
    fields: {
      account: row.account?.name ?? null,
      date: day(row.date),
      fees: row.fees_total,
      generateTransaction: row.generate_transaction,
      quantity: row.quantity?.toString() ?? null,
      type: row.type,
      unitPrice: row.unit_price?.toString() ?? null,
    },
    label: row.asset.ticker ?? row.asset.name,
    modules: row.transaction_id ? [ActivityModule.INVESTMENT, ActivityModule.FINANCE] : INVESTMENT,
    owners: [await ownerRef(client, row.asset.owner, row.asset.owner_id)],
    sources: names(row.account?.name, row.asset.name),
  };
}
function operationAmount(type: string, total: number | undefined): number | undefined {
  if (total === undefined) {
    return undefined;
  }

  return type === 'BUY' ? -total : total;
}
async function valuation(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.investmentValuation.findUnique({
    include: { asset: true },
    where: { id },
  });

  if (!row) {
    return null;
  }

  return {
    bookingDate: day(row.date),
    currency: row.asset.currency,
    entityId: row.id,
    entityType: ActivityEntityType.VALUATION,
    extra: { unitPrice: row.unit_price.toString() },
    fields: { date: day(row.date), unitPrice: row.unit_price.toString() },
    label: row.asset.ticker ?? row.asset.name,
    modules: INVESTMENT,
    owners: [await ownerRef(client, row.asset.owner, row.asset.owner_id)],
    sources: [row.asset.name],
  };
}

// Terms, rates and adjustments of a fixed-income title are one history item per asset (the terms row is keyed by it).
async function conversion(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.investmentConversion.findUnique({
    include: { from: true, to: true },
    where: { id },
  });

  if (!row) {
    return null;
  }

  const owners = [
    await ownerRef(client, row.from.owner, row.from.owner_id),
    ...(row.to.owner_id === row.from.owner_id
      ? []
      : [await ownerRef(client, row.to.owner, row.to.owner_id)]),
  ];

  return {
    amountCents: row.cash_amount ?? undefined,
    bookingDate: day(row.date),
    currency: row.from.currency,
    entityId: row.id,
    entityType: ActivityEntityType.CONVERSION,
    fields: {
      cashAmount: row.cash_amount,
      date: day(row.date),
      ratioFrom: row.ratio_from.toString(),
      ratioTo: row.ratio_to.toString(),
      to: row.to.ticker ?? row.to.name,
    },
    label: `${row.from.ticker ?? row.from.name} → ${row.to.ticker ?? row.to.name}`,
    modules: INVESTMENT,
    owners,
    sources: [row.from.name, row.to.name],
  };
}
async function fixedIncomeTerms(
  client: PrismaClient,
  id: string,
): Promise<ActivitySnapshot | null> {
  const row = await client.investmentFixedIncomeTerms.findUnique({
    include: { asset: true },
    where: { asset_id: id },
  });

  if (!row) {
    return null;
  }

  const rates = await client.investmentFixedIncomeRate.findMany({
    orderBy: { start_date: 'asc' },
    where: { asset_id: id },
  });

  return {
    currency: row.asset.currency,
    entityId: row.asset_id,
    entityType: ActivityEntityType.FIXED_INCOME_TERMS,
    fields: {
      liquidity: row.liquidity,
      liquidityDate: day(row.liquidity_date),
      maturityDate: day(row.maturity_date),
      product: row.product,
      rates: rates.map((rate) => `${day(rate.start_date)}:${rate.effective_rate.toString()}`),
      taxExempt: row.tax_exempt,
    },
    label: row.asset.name,
    modules: INVESTMENT,
    owners: [await ownerRef(client, row.asset.owner, row.asset.owner_id)],
  };
}
async function income(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.investmentIncome.findUnique({ include: { asset: true }, where: { id } });

  if (!row) {
    return null;
  }

  return {
    amountCents: row.net_amount,
    bookingDate: day(row.payment_date),
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.INCOME,
    extra: { incomeType: row.type },
    fields: {
      amountCents: row.net_amount,
      exDate: day(row.ex_date),
      notes: row.notes,
      paymentDate: day(row.payment_date),
      quantity: row.quantity?.toString() ?? null,
      received: row.received,
      type: row.type,
    },
    label: row.asset.ticker ?? row.asset.name,
    modules: row.transaction_id ? [ActivityModule.INVESTMENT, ActivityModule.FINANCE] : INVESTMENT,
    owners: [await ownerRef(client, row.asset.owner, row.asset.owner_id)],
    sources: [row.asset.name],
  };
}
async function incomeSeries(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.investmentIncomeSeries.findUnique({
    include: { asset: true },
    where: { id },
  });

  if (!row) {
    return null;
  }

  return {
    bookingDate: day(row.first_payment_date),
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.INCOME_SERIES,
    extra: { incomeType: row.type },
    fields: {
      amountPerUnit: row.amount_per_unit.toString(),
      endDate: day(row.end_date),
      firstPaymentDate: day(row.first_payment_date),
      frequencyInterval: row.frequency_interval,
      frequencyUnit: row.frequency_unit,
      notes: row.notes,
      type: row.type,
      withFinance: row.with_finance,
    },
    label: row.asset.ticker ?? row.asset.name,
    modules: row.with_finance ? [ActivityModule.INVESTMENT, ActivityModule.FINANCE] : INVESTMENT,
    owners: [await ownerRef(client, row.asset.owner, row.asset.owner_id)],
    sources: [row.asset.name],
  };
}

export const INVESTMENT_SNAPSHOTS: Partial<Record<ActivityEntityType, SnapshotReader>> = {
  [ActivityEntityType.ASSET]: asset,
  [ActivityEntityType.CONVERSION]: conversion,
  [ActivityEntityType.FIXED_INCOME_TERMS]: fixedIncomeTerms,
  [ActivityEntityType.INCOME]: income,
  [ActivityEntityType.INCOME_SERIES]: incomeSeries,
  [ActivityEntityType.OPERATION]: operation,
  [ActivityEntityType.VALUATION]: valuation,
};
