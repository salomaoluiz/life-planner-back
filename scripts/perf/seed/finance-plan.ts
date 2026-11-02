import { Rng } from './random';

const DAY_MS = 86_400_000;
const ICONS = ['shopping-cart', 'home', 'car', 'heart', 'star', 'gift', 'coffee', 'book'];
const BRANDS = ['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'OTHER'] as const;

export type PlanOwner = { kind: 'FAMILY'; familyIndex: number } | { kind: 'USER' };
export type TxType = 'EXPENSE' | 'INCOME';

export interface FinanceVolumes {
  accounts: number;
  archivedAccounts: number;
  cards: number;
  categories: number;
  installmentPlans: number;
  recurrences: number;
  referenceMonthMin: number;
  tags: number;
  transactions: number;
  years: number;
}

export interface FinancePlan {
  accounts: {
    archived: boolean;
    currency: 'BRL' | 'USD';
    icon: string;
    initialBalance: number;
    name: string;
    owner: PlanOwner;
  }[];
  cards: {
    brand: (typeof BRANDS)[number];
    closingDay: number;
    color: string;
    dueDay: number;
    lastDigits: string;
    limit: number;
    owner: PlanOwner;
    title: string;
  }[];
  categories: {
    icon: string;
    iconColor: string;
    name: string;
    parentIndex?: number;
    type: TxType;
  }[];
  earlyPayments: {
    accountIndex: number;
    cardIndex: number;
    date: string;
    description: string;
    invoiceMonth: string;
    value: number;
  }[];
  installmentPlans: {
    cardIndex: number;
    categoryIndex: number;
    date: string;
    description: string;
    installments: number;
    prepay: boolean;
    value: number;
  }[];
  recurrences: {
    accountIndex: number;
    categoryIndex: number;
    date: string;
    description: string;
    endDate?: string;
    frequency: 'MONTHLY' | 'WEEKLY';
    type: TxType;
    value: number;
  }[];
  referenceMonth: string;
  refunds: {
    cardIndex: number;
    date: string;
    description: string;
    invoiceMonth: string;
    value: number;
  }[];
  tags: string[];
  transactions: {
    accountIndex?: number;
    cardIndex?: number;
    categoryIndex: number;
    date: string;
    description: string;
    notes?: string;
    paid?: false;
    tags: string[];
    type: TxType;
    value: number;
  }[];
}

const pad = (value: number, size: number) => String(value).padStart(size, '0');

export function dayOffset(today: string, days: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// `YYYY-MM` that is `back` months before today's month.
export function monthsBack(today: string, back: number): string {
  const [year, month] = today.split('-').map(Number);
  const index = year * 12 + (month - 1) - back;

  return `${Math.floor(index / 12)}-${pad((index % 12) + 1, 2)}`;
}

function ownerFor(index: number, every: number, familyCount: number): PlanOwner {
  return familyCount > 0 && index % every === every - 1
    ? { familyIndex: index % familyCount, kind: 'FAMILY' }
    : { kind: 'USER' };
}

function buildCategories(count: number, rng: Rng): FinancePlan['categories'] {
  const roots = Math.max(2, Math.ceil(count * 0.15));
  const depths: number[] = [];
  const categories: FinancePlan['categories'] = [];

  for (let i = 0; i < count; i += 1) {
    let type: TxType = i % 3 === 2 ? 'INCOME' : 'EXPENSE';
    let parentIndex: number | undefined;
    if (i >= roots) {
      const candidates = depths.flatMap((depth, index) => (depth < 2 ? [index] : []));
      parentIndex = candidates[(i * 7) % candidates.length];
      type = categories[parentIndex].type;
    }
    depths.push(parentIndex === undefined ? 0 : depths[parentIndex] + 1);
    categories.push({
      icon: ICONS[i % ICONS.length],
      iconColor: rng.faker.color.rgb({ casing: 'lower', format: 'hex' }),
      name: `Perf cat ${pad(i, 3)}`,
      parentIndex,
      type,
    });
  }

  return categories;
}

function indexesOfType(categories: FinancePlan['categories'], type: TxType): number[] {
  return categories.flatMap((category, index) => (category.type === type ? [index] : []));
}

export function buildFinancePlan(
  cfg: FinanceVolumes,
  rng: Rng,
  today: string,
  familyCount: number,
): FinancePlan {
  const referenceMonth = monthsBack(today, 1);
  const categories = buildCategories(cfg.categories, rng);
  const expense = indexesOfType(categories, 'EXPENSE');
  const income = indexesOfType(categories, 'INCOME');
  const tags = Array.from({ length: cfg.tags }, (_, i) => `Perf tag ${pad(i, 2)}`);

  const accounts: FinancePlan['accounts'] = Array.from({ length: cfg.accounts }, (_, i) => ({
    archived: i >= cfg.accounts - cfg.archivedAccounts,
    currency: i % 6 === 5 ? 'USD' : 'BRL',
    icon: 'bank',
    initialBalance: rng.faker.number.int({ max: 500_000, min: 0 }),
    name: `Perf account ${pad(i, 2)}`,
    owner: ownerFor(i, 4, familyCount),
  }));

  const cards: FinancePlan['cards'] = Array.from({ length: cfg.cards }, (_, i) => {
    const closingDay = 1 + ((i * 5) % 28);

    return {
      brand: BRANDS[i % BRANDS.length],
      closingDay,
      color: rng.faker.color.rgb({ casing: 'lower', format: 'hex' }),
      dueDay: 1 + ((closingDay + 9) % 28),
      lastDigits: String(1000 + i),
      limit: 100_000_000,
      owner: ownerFor(i, 5, familyCount),
      title: `Perf card ${pad(i, 2)}`,
    };
  });

  const spanDays = cfg.years * 365 - 1;
  const transactions: FinancePlan['transactions'] = Array.from(
    { length: cfg.transactions },
    (_, index) => {
      const isCard = index % 10 < 3 && cards.length > 0;
      const type: TxType = !isCard && index % 4 === 3 ? 'INCOME' : 'EXPENSE';
      const pool = type === 'INCOME' ? income : expense;
      const tagCount = index % 3 === 0 ? 1 + (index % 4) : 0;
      const date =
        index < cfg.referenceMonthMin
          ? `${referenceMonth}-${pad(1 + (index % 28), 2)}`
          : dayOffset(today, -(1 + ((index * 7919) % spanDays)));

      return {
        accountIndex: isCard ? undefined : index % accounts.length,
        cardIndex: isCard ? index % cards.length : undefined,
        categoryIndex: pool[(index * 13) % pool.length],
        date,
        description: `Perf tx ${pad(index, 5)}`,
        notes: index % 10 === 0 ? rng.faker.lorem.sentence().slice(0, 200) : undefined,
        paid: !isCard && index % 11 === 0 ? (false as const) : undefined,
        tags: Array.from({ length: tagCount }, (_, k) => tags[(index * (k + 3)) % tags.length]),
        type,
        value: rng.faker.number.int({ max: 50_000, min: 100 }),
      };
    },
  );

  const installmentPlans: FinancePlan['installmentPlans'] = Array.from(
    { length: cfg.installmentPlans },
    (_, i) => {
      const installments = i === 0 ? 12 : 2 + ((i * 5) % 11);

      return {
        cardIndex: i % cards.length,
        categoryIndex: expense[(i * 5) % expense.length],
        date: dayOffset(today, i === 0 ? -10 : -(20 + ((i * 37) % 600))),
        description: `Perf plan ${pad(i, 2)}`,
        installments,
        prepay: i === 0,
        value: installments * (1000 + rng.faker.number.int({ max: 20_000, min: 0 })),
      };
    },
  );

  const activeAccounts = Math.max(1, cfg.accounts - cfg.archivedAccounts);
  const recurrences: FinancePlan['recurrences'] = Array.from(
    { length: cfg.recurrences },
    (_, i) => {
      const type: TxType = i % 4 === 3 ? 'INCOME' : 'EXPENSE';
      const pool = type === 'INCOME' ? income : expense;
      const date = dayOffset(today, -(30 + ((i * 53) % 700)));

      return {
        accountIndex: i % activeAccounts,
        categoryIndex: pool[(i * 3) % pool.length],
        date,
        description: `Perf rec ${pad(i, 2)}`,
        endDate: i % 6 === 5 ? dayOffset(today, -5) : undefined,
        frequency: i % 5 === 4 ? 'WEEKLY' : 'MONTHLY',
        type,
        value: rng.faker.number.int({ max: 30_000, min: 500 }),
      };
    },
  );

  const refunds: FinancePlan['refunds'] = Array.from(
    { length: Math.min(3, cards.length) },
    (_, i) => {
      const month = monthsBack(today, 2 + i * 3);

      // The first refund is larger than the invoice, so that invoice ends negative.
      return {
        cardIndex: i % cards.length,
        date: `${month}-15`,
        description: `Perf refund ${i + 1}`,
        invoiceMonth: month,
        value: i === 0 ? 3_000_000 : 5000,
      };
    },
  );

  const earlyPayments: FinancePlan['earlyPayments'] = Array.from(
    { length: Math.min(2, cards.length) },
    (_, i) => {
      const month = monthsBack(today, 3 + i);

      return {
        accountIndex: 0,
        cardIndex: i,
        date: `${month}-10`,
        description: `Perf early ${i + 1}`,
        invoiceMonth: month,
        value: 10_000,
      };
    },
  );

  return {
    accounts,
    cards,
    categories,
    earlyPayments,
    installmentPlans,
    recurrences,
    referenceMonth,
    refunds,
    tags,
    transactions,
  };
}
