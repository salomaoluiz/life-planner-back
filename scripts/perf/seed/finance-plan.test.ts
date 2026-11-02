import { buildFinancePlan } from './finance-plan';
import { createRng } from './random';

const cfg = {
  accounts: 18,
  archivedAccounts: 3,
  cards: 5,
  categories: 120,
  installmentPlans: 40,
  recurrences: 20,
  referenceMonthMin: 300,
  tags: 30,
  transactions: 11200,
  years: 7,
};
const today = '2026-11-02';
const build = () => buildFinancePlan(cfg, createRng(64), today, 3);

describe('buildFinancePlan', () => {
  const plan = build();

  it('is deterministic for the same seed', () => {
    expect(build()).toEqual(plan);
  });

  it('matches the configured volumes', () => {
    expect(plan.categories).toHaveLength(120);
    expect(plan.tags).toHaveLength(30);
    expect(plan.accounts).toHaveLength(18);
    expect(plan.accounts.filter((a) => a.archived)).toHaveLength(3);
    expect(plan.cards).toHaveLength(5);
    expect(plan.transactions).toHaveLength(11200);
    expect(plan.installmentPlans).toHaveLength(40);
    expect(plan.recurrences).toHaveLength(20);
  });

  it('builds a category tree whose parents come first, with unique Perf names and icons', () => {
    const seen = new Set<number>();
    plan.categories.forEach((category, index) => {
      expect(category.name.startsWith('Perf cat ')).toBe(true);
      expect(category.icon.length).toBeGreaterThan(0);
      expect(category.iconColor).toMatch(/^#[0-9a-f]{6}$/i);
      if (category.parentIndex !== undefined) {
        expect(seen.has(category.parentIndex)).toBe(true);
        expect(plan.categories[category.parentIndex].type).toBe(category.type);
      }
      seen.add(index);
    });
    expect(plan.categories.some((c) => c.parentIndex !== undefined)).toBe(true);
    expect(new Set(plan.categories.map((c) => c.name)).size).toBe(120);
  });

  it('uses at most 10 tags per row and only known tag names', () => {
    const known = new Set(plan.tags);
    expect(
      plan.transactions.every((t) => t.tags.length <= 10 && t.tags.every((n) => known.has(n))),
    ).toBe(true);
    expect(plan.transactions.some((t) => t.tags.length > 0)).toBe(true);
    expect(plan.tags.every((name) => name.length <= 30)).toBe(true);
  });

  it('has at least 300 rows in the reference month, the month before today', () => {
    const inMonth = plan.transactions.filter((t) => t.date.startsWith(plan.referenceMonth));

    expect(plan.referenceMonth).toBe('2026-10');
    expect(inMonth.length).toBeGreaterThanOrEqual(300);
  });

  it('spans seven years with integer positive values and valid targets', () => {
    const oldest = plan.transactions.reduce((min, t) => (t.date < min ? t.date : min), today);

    expect(oldest >= '2019-10-01').toBe(true);
    expect(oldest < '2021-01-01').toBe(true);
    expect(plan.transactions.every((t) => Number.isInteger(t.value) && t.value >= 1)).toBe(true);
    expect(plan.transactions.every((t) => t.date <= today)).toBe(true);
    expect(
      plan.transactions.every(
        (t) => (t.accountIndex === undefined) !== (t.cardIndex === undefined),
      ),
    ).toBe(true);
    expect(plan.transactions.every((t) => plan.categories[t.categoryIndex].type === t.type)).toBe(
      true,
    );
  });

  it('mixes currencies, scopes, paid states, notes, cards and archived accounts', () => {
    expect(new Set(plan.accounts.map((a) => a.currency)).size).toBe(2);
    expect(new Set(plan.accounts.map((a) => a.owner.kind)).size).toBe(2);
    expect(plan.transactions.some((t) => t.paid === false)).toBe(true);
    expect(plan.transactions.some((t) => t.notes)).toBe(true);
    expect(plan.transactions.some((t) => t.cardIndex !== undefined)).toBe(true);
    expect(plan.refunds.length).toBeGreaterThan(0);
    expect(plan.earlyPayments.length).toBeGreaterThan(0);
  });

  it('has due recurrences (monthly and weekly) and a prepaid plan', () => {
    expect(plan.recurrences.some((r) => r.frequency === 'WEEKLY')).toBe(true);
    expect(plan.recurrences.some((r) => r.frequency === 'MONTHLY')).toBe(true);
    expect(plan.recurrences.every((r) => r.date < today)).toBe(true);
    expect(plan.installmentPlans[0].prepay).toBe(true);
    expect(
      plan.installmentPlans.every((p) => p.installments >= 2 && p.value >= p.installments),
    ).toBe(true);
  });

  it('falls back to user scope when there are no families', () => {
    const solo = buildFinancePlan(cfg, createRng(64), today, 0);

    expect(solo.accounts.every((a) => a.owner.kind === 'USER')).toBe(true);
  });
});
