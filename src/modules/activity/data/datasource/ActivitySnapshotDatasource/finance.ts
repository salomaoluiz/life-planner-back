import {
  day,
  FINANCE,
  names,
  ownerRef,
  signed,
  SnapshotReader,
} from '@activity/data/datasource/ActivitySnapshotDatasource/helpers';
import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityEntityType } from '@activity/domain/enum';
import { PrismaClient } from '@db/client';

// The route adjusts the balance of an account: the entry is about that account (`id` is the account id).
async function balanceAdjustment(
  client: PrismaClient,
  id: string,
): Promise<ActivitySnapshot | null> {
  const row = await client.financialAccount.findUnique({ where: { id } });

  if (!row) {
    return null;
  }

  return {
    amountCents: row.ledger_balance,
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.BALANCE_ADJUSTMENT,
    fields: {},
    label: row.name,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
    sources: [row.name],
  };
}

// `ownerType|ownerId` of a CSV import: the owner is the whole content of the snapshot (the rows are the batch items).
async function account(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.financialAccount.findUnique({
    include: { favorites: { select: { user_id: true } } },
    where: { id },
  });

  if (!row) {
    return null;
  }

  return {
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.ACCOUNT,
    fields: {
      archived: row.status !== 'ACTIVE',
      favorite: row.favorites.length > 0,
      icon: row.icon,
      initialBalance: row.initial_balance,
      name: row.name,
      type: row.type,
    },
    label: row.name,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
  };
}
async function category(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.financialCategory.findUnique({
    include: { parent: true },
    where: { id },
  });

  if (!row?.owner || !row.owner_id) {
    return null;
  }

  return {
    entityId: row.id,
    entityType: ActivityEntityType.CATEGORY,
    fields: {
      archived: row.status !== 'ACTIVE',
      color: row.icon_color,
      excludeFromTotals: row.exclude_from_totals,
      icon: row.icon,
      name: row.name,
      owner: row.owner_id,
      parent: row.parent?.name ?? null,
      type: row.type,
    },
    label: row.name,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
  };
}
async function creditCard(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.financialCreditCard.findUnique({
    include: { payment_account: true },
    where: { id },
  });

  if (!row) {
    return null;
  }

  return {
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.CREDIT_CARD,
    fields: {
      archived: row.status !== 'ACTIVE',
      brand: row.brand,
      closingDay: row.closing_day,
      color: row.color,
      dueDay: row.due_day,
      lastDigits: row.last_digits,
      limit: row.limit,
      paymentAccount: row.payment_account?.name ?? null,
      title: row.title,
    },
    label: row.title,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
  };
}
async function installmentPlan(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.financialInstallmentPlan.findUnique({
    include: { category: true, credit_card: true },
    where: { id },
  });

  if (!row) {
    return null;
  }

  return {
    amountCents: -row.total_value,
    bookingDate: day(row.date),
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.INSTALLMENT_PLAN,
    extra: { installmentCount: row.installment_count },
    fields: {
      category: row.category.name,
      creditCard: row.credit_card.title,
      date: day(row.date),
      description: row.description,
      installmentCount: row.installment_count,
      notes: row.notes,
      totalValue: row.total_value,
    },
    label: row.description,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
    sources: [row.credit_card.title],
  };
}
async function invoicePayment(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  // `cardId:YYYY-MM` finds the payment of an invoice (the routes do not carry the payment id).
  const [cardId, month] = id.split(':');
  const include = { account: true, credit_card: true };
  const row = month
    ? await client.financialInvoicePayment.findFirst({
        include,
        where: { credit_card_id: cardId, invoice_month: month },
      })
    : await client.financialInvoicePayment.findUnique({ include, where: { id } });

  if (!row) {
    return null;
  }

  return {
    amountCents: -row.amount,
    bookingDate: day(row.paid_on),
    currency: row.credit_card.currency,
    entityId: row.id,
    entityType: ActivityEntityType.INVOICE_PAYMENT,
    extra: { invoiceMonth: row.invoice_month },
    fields: {
      account: row.account?.name ?? null,
      amountCents: -row.amount,
      method: row.method,
      paidOn: day(row.paid_on),
    },
    label: `${row.credit_card.title} ${row.invoice_month}`,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
    sources: names(row.credit_card.title, row.account?.name),
  };
}
async function prepayment(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  // `plan:<planId>` finds the prepayment of a plan (the routes carry the plan id).
  const include = {
    discount_transaction: true,
    installment_plan: { include: { credit_card: true } },
  };
  const row = id.startsWith('plan:')
    ? await client.financialInstallmentPrepayment.findFirst({
        include,
        where: { installment_plan_id: id.slice(5) },
      })
    : await client.financialInstallmentPrepayment.findUnique({ include, where: { id } });

  if (!row) {
    return null;
  }

  return {
    bookingDate: day(row.date),
    currency: row.installment_plan.currency,
    entityId: row.id,
    entityType: ActivityEntityType.INSTALLMENT_PREPAYMENT,
    fields: {
      discount: row.discount_transaction?.value ?? 0,
      targetInvoiceMonth: row.target_invoice_month,
    },
    label: row.installment_plan.description,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
    sources: [row.installment_plan.credit_card.title],
  };
}
async function recurrence(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.financialRecurrence.findUnique({
    include: { account: true, category: true, credit_card: true, to_account: true },
    where: { id },
  });

  if (!row) {
    return null;
  }

  return {
    amountCents: signed(row.value, row.type),
    bookingDate: day(row.start_date),
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.RECURRENCE,
    fields: {
      account: row.account?.name ?? null,
      amountCents: signed(row.value, row.type),
      category: row.category.name,
      creditCard: row.credit_card?.title ?? null,
      description: row.description,
      endDate: day(row.end_date),
      frequencyInterval: row.frequency_interval,
      frequencyUnit: row.frequency_unit,
      notes: row.notes,
      skippedNumbers: [...row.skipped_numbers].sort((a, b) => a - b),
      startDate: day(row.start_date),
      status: row.status,
      toAccount: row.to_account?.name ?? null,
    },
    label: row.description,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
    sources: names(row.account?.name, row.credit_card?.title),
  };
}
async function split(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.financialSplit.findUnique({
    include: { account: true, credit_card: true, transactions: true },
    where: { id },
  });

  if (!row) {
    return null;
  }

  const total = row.transactions.reduce((sum, part) => sum + signed(part.value, part.type), 0);

  return {
    amountCents: total,
    bookingDate: day(row.date),
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.SPLIT,
    extra: { parts: row.transactions.length },
    fields: {
      account: row.account?.name ?? null,
      creditCard: row.credit_card?.title ?? null,
      date: day(row.date),
      description: row.description,
      notes: row.notes,
      paid: row.paid,
      parts: row.transactions.map((part) => `${part.description}:${part.value}`).sort(),
    },
    label: row.description,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
    sources: names(row.account?.name, row.credit_card?.title),
  };
}
async function stockPurchase(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.stockPurchase.findUnique({ include: { market: true }, where: { id } });

  if (!row) {
    return null;
  }

  return {
    amountCents: row.receipt_total_cents ? -row.receipt_total_cents : undefined,
    bookingDate: day(row.purchase_date),
    currency: row.currency,
    entityId: row.id,
    entityType: ActivityEntityType.STOCK_PURCHASE_POSTING,
    extra: { market: row.market.name },
    fields: { status: row.status },
    label: row.market.name,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
  };
}
async function tag(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.financialTag.findUnique({ where: { id } });

  if (!row) {
    return null;
  }

  return {
    entityId: row.id,
    entityType: ActivityEntityType.TAG,
    fields: { allScopes: row.all_scopes, name: row.name },
    label: row.name,
    modules: FINANCE,
    owners: [await ownerRef(client, row.owner, row.owner_id)],
  };
}
function transaction(entityType: ActivityEntityType): SnapshotReader {
  return async (client, id) => {
    const row = await client.financialTransaction.findUnique({
      include: {
        account: true,
        category: true,
        credit_card: true,
        tags: { include: { tag: true } },
      },
      where: { id },
    });

    if (!row) {
      return null;
    }

    return {
      amountCents: signed(row.value, row.type),
      bookingDate: day(row.date),
      currency: row.currency,
      entityId: row.id,
      entityType,
      fields: {
        account: row.account?.name ?? null,
        amountCents: signed(row.value, row.type),
        category: row.category.name,
        creditCard: row.credit_card?.title ?? null,
        date: day(row.date),
        description: row.description,
        invoiceMonth: row.invoice_month,
        notes: row.notes,
        paid: row.paid,
        projected: row.projected,
        tags: row.tags.map((link) => link.tag.name).sort(),
      },
      label: row.description,
      modules: FINANCE,
      owners: [await ownerRef(client, row.owner, row.owner_id)],
      refs: { installmentPlanId: row.installment_plan_id, recurrenceId: row.recurrence_id },
      sources: names(row.account?.name, row.credit_card?.title),
    };
  };
}
async function transactionImport(
  client: PrismaClient,
  id: string,
): Promise<ActivitySnapshot | null> {
  const [owner, ownerId] = id.split('|');

  return {
    entityId: '',
    entityType: ActivityEntityType.TRANSACTION_IMPORT,
    fields: {},
    label: 'CSV',
    modules: FINANCE,
    owners: [await ownerRef(client, owner as 'FAMILY' | 'USER', ownerId)],
  };
}
async function transfer(client: PrismaClient, id: string): Promise<ActivitySnapshot | null> {
  const row = await client.financialTransfer.findUnique({
    include: { from_account: true, to_account: true },
    where: { id },
  });
  const account = row?.from_account ?? row?.to_account;

  if (!row || !account) {
    return null;
  }

  return {
    amountCents: -row.amount_out,
    bookingDate: day(row.date_out),
    currency: row.currency_out,
    entityId: row.id,
    entityType: ActivityEntityType.TRANSFER,
    fields: {
      amountIn: row.amount_in,
      amountOut: row.amount_out,
      dateIn: day(row.date_in),
      dateOut: day(row.date_out),
      description: row.description,
      fee: row.fee,
      fromAccount: row.from_account?.name ?? null,
      notes: row.notes,
      paid: row.paid,
      toAccount: row.to_account?.name ?? null,
    },
    label: row.description,
    modules: FINANCE,
    owners: [
      await ownerRef(client, account.owner, account.owner_id),
      ...(row.from_account &&
      row.to_account &&
      row.from_account.owner_id !== row.to_account.owner_id
        ? [await ownerRef(client, row.to_account.owner, row.to_account.owner_id)]
        : []),
    ],
    refs: { recurrenceId: row.recurrence_id },
    sources: names(row.from_account?.name, row.to_account?.name),
  };
}

export const FINANCE_SNAPSHOTS: Partial<Record<ActivityEntityType, SnapshotReader>> = {
  [ActivityEntityType.ACCOUNT]: account,
  [ActivityEntityType.BALANCE_ADJUSTMENT]: balanceAdjustment,
  [ActivityEntityType.CARD_EARLY_PAYMENT]: transaction(ActivityEntityType.CARD_EARLY_PAYMENT),
  [ActivityEntityType.CARD_REFUND]: transaction(ActivityEntityType.CARD_REFUND),
  [ActivityEntityType.CATEGORY]: category,
  [ActivityEntityType.CREDIT_CARD]: creditCard,
  [ActivityEntityType.INSTALLMENT_PLAN]: installmentPlan,
  [ActivityEntityType.INSTALLMENT_PREPAYMENT]: prepayment,
  [ActivityEntityType.INVOICE_PAYMENT]: invoicePayment,
  [ActivityEntityType.RECURRENCE]: recurrence,
  [ActivityEntityType.SPLIT]: split,
  [ActivityEntityType.STOCK_PURCHASE_POSTING]: stockPurchase,
  [ActivityEntityType.TAG]: tag,
  [ActivityEntityType.TRANSACTION]: transaction(ActivityEntityType.TRANSACTION),
  [ActivityEntityType.TRANSACTION_IMPORT]: transactionImport,
  [ActivityEntityType.TRANSFER]: transfer,
};
