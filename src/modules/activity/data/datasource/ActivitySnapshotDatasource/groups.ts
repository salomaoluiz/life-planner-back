import { day, signed } from '@activity/data/datasource/ActivitySnapshotDatasource/helpers';
import { ActivityItemInput } from '@activity/domain/entity/ActivityEntry';
import { ActivityAction, ActivityEntityType, ActivityGroupKind } from '@activity/domain/enum';
import { Prisma, PrismaClient } from '@db/client';

type GroupReader = (client: PrismaClient, id: string) => Promise<ActivityItemInput[]>;

const TX_INCLUDE = { account: true, credit_card: true } as const;

async function categorySubtree(client: PrismaClient, id: string): Promise<ActivityItemInput[]> {
  const root = await client.financialCategory.findUnique({ where: { id } });
  const children = root
    ? await client.financialCategory.findMany({
        where: { OR: [{ parent_id: id }, { parent: { parent_id: id } }] },
      })
    : [];

  return [...(root ? [root] : []), ...children].map((row) => ({
    action: ActivityAction.CREATE,
    entityId: row.id,
    entityType: ActivityEntityType.CATEGORY,
    label: `${row.name}${row.status === 'ACTIVE' ? '' : ' (archived)'}:${row.icon_color}:${row.icon}`,
  }));
}
async function conversionRows(client: PrismaClient, id: string): Promise<ActivityItemInput[]> {
  const rows = await client.investmentOperation.findMany({
    include: { asset: true },
    orderBy: [{ date: 'desc' }, { id: 'asc' }],
    where: { conversion_id: id },
  });

  return rows.map((row) => ({
    action: ActivityAction.CREATE,
    amountCents: row.total ?? undefined,
    bookingDate: day(row.date),
    currency: row.asset.currency,
    entityId: row.id,
    entityType: ActivityEntityType.OPERATION,
    label: `${row.type} ${row.asset.ticker ?? row.asset.name}`,
    sourceName: row.asset.name,
  }));
}
async function incomeSeriesRows(client: PrismaClient, id: string): Promise<ActivityItemInput[]> {
  const rows = await client.investmentIncome.findMany({
    include: { asset: true },
    orderBy: [{ payment_date: 'desc' }, { id: 'asc' }],
    where: { series_id: id },
  });

  return rows.map((row) => ({
    action: ActivityAction.CREATE,
    amountCents: row.net_amount,
    bookingDate: day(row.payment_date),
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.INCOME,
    label: `${row.asset.ticker ?? row.asset.name}${row.received ? ' ✓' : ''}`,
    sourceName: row.asset.name,
  }));
}
async function recurrenceRows(client: PrismaClient, id: string): Promise<ActivityItemInput[]> {
  const [rows, transfers, splits] = await Promise.all([
    transactions(client, { recurrence_id: id, split_id: null, transfer_id: null }),
    client.financialTransfer.findMany({
      include: { from_account: true },
      where: { recurrence_id: id },
    }),
    client.financialSplit.findMany({
      include: { account: true, credit_card: true, transactions: true },
      where: { recurrence_id: id },
    }),
  ]);

  return [
    ...rows,
    ...transfers.map((row) => ({
      action: ActivityAction.CREATE,
      amountCents: -row.amount_out,
      bookingDate: day(row.date_out),
      currency: row.currency_out,
      entityId: row.id,
      entityType: ActivityEntityType.TRANSFER,
      label: row.description,
      sourceName: row.from_account?.name ?? null,
    })),
    ...splits.map((row) => ({
      action: ActivityAction.CREATE,
      amountCents: row.transactions.reduce((sum, part) => sum + signed(part.value, part.type), 0),
      bookingDate: day(row.date),
      currency: row.currency,
      entityId: row.id,
      entityType: ActivityEntityType.SPLIT,
      label: row.description,
      sourceName: row.account?.name ?? row.credit_card?.title ?? null,
    })),
  ];
}
async function transactions(
  client: PrismaClient,
  where: Prisma.FinancialTransactionWhereInput,
): Promise<ActivityItemInput[]> {
  const rows = await client.financialTransaction.findMany({
    include: TX_INCLUDE,
    orderBy: [{ date: 'desc' }, { id: 'asc' }],
    where,
  });

  return rows.map((row) => ({
    action: ActivityAction.CREATE,
    amountCents: signed(row.value, row.type),
    bookingDate: day(row.date),
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.TRANSACTION,
    label: row.description,
    sourceName: row.account?.name ?? row.credit_card?.title ?? null,
  }));
}

export const GROUP_READERS: Record<ActivityGroupKind, GroupReader> = {
  [ActivityGroupKind.CATEGORY_SUBTREE]: categorySubtree,
  [ActivityGroupKind.CONVERSION_ROWS]: conversionRows,
  [ActivityGroupKind.INCOME_SERIES_ROWS]: incomeSeriesRows,
  [ActivityGroupKind.INSTALLMENT_PLAN_ROWS]: async (client, id) =>
    transactions(client, { installment_plan_id: id }),
  [ActivityGroupKind.PREPAYMENT_ROWS]: async (client, id) =>
    transactions(client, { prepayment_id: id }),
  [ActivityGroupKind.RECURRENCE_ROWS]: recurrenceRows,
  [ActivityGroupKind.SPLIT_ROWS]: async (client, id) => transactions(client, { split_id: id }),
  [ActivityGroupKind.TRANSACTION_IDS]: async (client, id) =>
    id === '' ? [] : transactions(client, { id: { in: id.split(',') } }),
};
