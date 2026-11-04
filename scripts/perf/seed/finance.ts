import { listAllTransactions } from '../measure/dataset';
import { ApiClient } from './client';
import { buildFinancePlan, FinanceVolumes, monthsBack, PlanOwner } from './finance-plan';
import { Rng } from './random';

type Client = Pick<ApiClient, 'get' | 'patch' | 'post'>;
type NamedRow = {
  description?: string;
  id: string;
  installmentPlanId?: null | string;
  name?: string;
  status?: string;
  title?: string;
};

const BASE = '/api/v1/finance';

export interface FinanceRefs {
  familyIds: string[];
  userId: string;
}

function matches(description: string, wanted: string): boolean {
  return description === wanted || description.startsWith(`${wanted} `);
}

export async function seedFinance(
  client: Client,
  cfg: FinanceVolumes,
  refs: FinanceRefs,
  today: string,
  rng: Rng,
): Promise<{ counts: Record<string, number>; referenceMonth: string }> {
  const plan = buildFinancePlan(cfg, rng, today, refs.familyIds.length);
  let created = 0;
  const post = async <T>(path: string, body: unknown): Promise<T> => {
    created += 1;

    return client.post<T>(path, body);
  };
  const ownerOf = (owner: PlanOwner) =>
    owner.kind === 'FAMILY'
      ? { owner: 'FAMILY', ownerId: refs.familyIds[owner.familyIndex % refs.familyIds.length] }
      : { owner: 'USER', ownerId: refs.userId };
  const byName = (rows: NamedRow[], key: 'name' | 'title', prefix: string) =>
    new Map(rows.filter((r) => r[key]?.startsWith(prefix)).map((r) => [r[key] as string, r]));

  // 1. Categories (parents first) and tags, both visible in every scope.
  const existingCategories = byName(
    await client.get<NamedRow[]>(`${BASE}/categories`),
    'name',
    'Perf cat ',
  );
  const categoryIds: string[] = [];
  for (const category of plan.categories) {
    let id = existingCategories.get(category.name)?.id;
    if (!id) {
      ({ id } = await post<{ id: string }>(`${BASE}/categories`, {
        icon: category.icon,
        iconColor: category.iconColor,
        name: category.name,
        owner: 'ALL',
        parentId:
          category.parentIndex === undefined ? undefined : categoryIds[category.parentIndex],
        type: category.type,
      }));
    }
    categoryIds.push(id);
  }
  const existingTags = byName(await client.get<NamedRow[]>(`${BASE}/tags`), 'name', 'Perf tag ');
  for (const name of plan.tags.filter((tag) => !existingTags.has(tag))) {
    await post(`${BASE}/tags`, { name, owner: 'ALL' });
  }

  // 2. Accounts and cards.
  const existingAccounts = byName(
    await client.get<NamedRow[]>(`${BASE}/accounts`),
    'name',
    'Perf account ',
  );
  const accountIds: string[] = [];
  const newAccountIds: string[] = [];
  for (const account of plan.accounts) {
    let id = existingAccounts.get(account.name)?.id;
    if (!id) {
      ({ id } = await post<{ id: string }>(`${BASE}/accounts`, {
        currency: account.currency,
        icon: account.icon,
        initialBalance: account.initialBalance,
        name: account.name,
        ...ownerOf(account.owner),
      }));
      newAccountIds.push(id);
    }
    accountIds.push(id);
  }
  const existingCards = byName(
    await client.get<NamedRow[]>(`${BASE}/credit-cards`),
    'title',
    'Perf card ',
  );
  const cardIds: string[] = [];
  for (const card of plan.cards) {
    let id = existingCards.get(card.title)?.id;
    if (!id) {
      ({ id } = await post<{ id: string }>(`${BASE}/credit-cards`, {
        brand: card.brand,
        closingDay: card.closingDay,
        color: card.color,
        dueDay: card.dueDay,
        lastDigits: card.lastDigits,
        limit: card.limit,
        title: card.title,
        ...ownerOf(card.owner),
      }));
    }
    cardIds.push(id);
  }

  // 3. Transactions: only the descriptions not there yet.
  // The list splits account rows and card purchases by source.
  const rows = [
    ...(await listAllTransactions<NamedRow>(client, 'source=ACCOUNT')),
    ...(await listAllTransactions<NamedRow>(client, 'source=CARD')),
  ];
  const descriptions = rows.map((r) => r.description ?? '');
  const known = new Set(descriptions);
  for (const tx of plan.transactions.filter((t) => !known.has(t.description))) {
    const source =
      tx.accountIndex === undefined
        ? plan.cards[tx.cardIndex as number]
        : plan.accounts[tx.accountIndex];
    await post(`${BASE}/transactions`, {
      accountId: tx.accountIndex === undefined ? undefined : accountIds[tx.accountIndex],
      categoryId: categoryIds[tx.categoryIndex],
      creditCardId: tx.cardIndex === undefined ? undefined : cardIds[tx.cardIndex],
      date: tx.date,
      description: tx.description,
      notes: tx.notes,
      paid: tx.paid,
      tags: tx.tags.length > 0 ? tx.tags : undefined,
      type: tx.type,
      value: tx.value,
      ...ownerOf(source.owner),
    });
  }

  // 4. Installment plans (the first one gets a prepayment) and recurrences.
  const prepay = (planId: string) =>
    post(`${BASE}/installment-plans/${planId}/prepayment`, {
      date: today,
      targetInvoiceMonth: today.slice(0, 7),
    });
  for (const item of plan.installmentPlans) {
    const existingRow = rows.find(
      (r) => r.installmentPlanId && matches(r.description ?? '', item.description),
    );
    if (existingRow) {
      // An earlier run may have stopped before the prepayment.
      const planId = existingRow.installmentPlanId as string;
      if (item.prepay) {
        const { installments } = await client.get<{ installments: { prepaid: boolean }[] }>(
          `${BASE}/installment-plans/${planId}`,
        );
        if (!installments.some((i) => i.prepaid)) await prepay(planId);
      }
      continue;
    }
    if (descriptions.some((d) => matches(d, item.description))) continue;
    const card = plan.cards[item.cardIndex];
    const result = await post<{ plan: { id: string } }>(`${BASE}/installment-plans`, {
      categoryId: categoryIds[item.categoryIndex],
      creditCardId: cardIds[item.cardIndex],
      date: item.date,
      description: item.description,
      installments: item.installments,
      value: item.value,
      ...ownerOf(card.owner),
    });
    if (item.prepay) await prepay(result.plan.id);
  }
  const existingRecurrences = new Set(
    (await client.get<NamedRow[]>(`${BASE}/recurrences`)).map((r) => r.description ?? ''),
  );
  for (const item of plan.recurrences.filter((r) => !existingRecurrences.has(r.description))) {
    await post(`${BASE}/recurrences`, {
      accountId: accountIds[item.accountIndex],
      categoryId: categoryIds[item.categoryIndex],
      date: item.date,
      description: item.description,
      endDate: item.endDate,
      frequency: item.frequency,
      type: item.type,
      value: item.value,
      ...ownerOf(plan.accounts[item.accountIndex].owner),
    });
  }

  // 5. Card credits, balance adjustments and invoice payments.
  for (const item of plan.refunds.filter(
    (r) => !descriptions.some((d) => matches(d, r.description)),
  )) {
    await post(`${BASE}/credit-cards/${cardIds[item.cardIndex]}/refunds`, {
      date: item.date,
      description: item.description,
      invoiceMonth: item.invoiceMonth,
      value: item.value,
    });
  }
  for (const item of plan.earlyPayments.filter(
    (e) => !descriptions.some((d) => matches(d, e.description)),
  )) {
    await post(`${BASE}/credit-cards/${cardIds[item.cardIndex]}/early-payments`, {
      accountId: accountIds[item.accountIndex],
      date: item.date,
      description: item.description,
      invoiceMonth: item.invoiceMonth,
      method: 'ACCOUNT',
      value: item.value,
    });
  }
  for (const [i, id] of newAccountIds.slice(0, 3).entries()) {
    await post(`${BASE}/accounts/${id}/balance-adjustment`, { balance: 100_000 + i * 1000 });
  }
  for (const cardId of cardIds) {
    for (let back = 2; back <= 13; back += 1) {
      const path = `${BASE}/credit-cards/${cardId}/invoices/${monthsBack(today, back)}`;
      const detail = await client.get<{
        credits: unknown[];
        invoice: { amountDue?: number; payment: unknown };
        purchases: unknown[];
      }>(path);
      const hasRows = detail.purchases.length + detail.credits.length > 0;
      if (hasRows && !detail.invoice.payment && (detail.invoice.amountDue ?? 1) > 0) {
        await post(`${path}/payment`, { method: 'EXTERNAL' });
      }
    }
  }

  // 6. Archive last, archived accounts refuse new transactions.
  const statusById = new Map(
    (await client.get<NamedRow[]>(`${BASE}/accounts`)).map((row) => [row.id, row.status]),
  );
  for (const [index, account] of plan.accounts.entries()) {
    if (account.archived && statusById.get(accountIds[index]) !== 'ARCHIVED') {
      created += 1;
      await client.patch(`${BASE}/accounts/${accountIds[index]}`, { status: 'ARCHIVED' });
    }
  }

  return {
    counts: {
      accounts: plan.accounts.length,
      cards: plan.cards.length,
      categories: plan.categories.length,
      financeCreated: created,
      installmentPlans: plan.installmentPlans.length,
      recurrences: plan.recurrences.length,
      tags: plan.tags.length,
      transactions: plan.transactions.length,
    },
    referenceMonth: plan.referenceMonth,
  };
}
