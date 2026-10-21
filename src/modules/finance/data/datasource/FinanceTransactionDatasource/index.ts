import { Injectable, NotFoundException } from '@nestjs/common';

import { OwnerType, Prisma } from '@db/client';
import {
  applyLedgerDeltas,
  assertInvoiceNotPaid,
  lockCards,
  lockTransactionRow,
  toLedgerEntry,
} from '@finance/data/datasource/ledger';
import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  applyTagNames,
  resolveTagIds,
  TAG_INCLUDE,
  tagNamesOfRow,
  uniqueNames,
} from '@finance/data/datasource/tags';
import {
  CardInvoiceKey,
  CardInvoiceSum,
  CreateTransactionDatasourceParams,
  DashboardSumRow,
  DashboardSumsParams,
  DuplicateCandidate,
  ExistsTransactionDatasourceParams,
  ExportTransactionsDatasourceParams,
  FinancialTransactionWithRelations,
  FindTransactionsFilter,
  IFinanceTransactionDatasource,
  UpdateTransactionDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey, TransactionSource, TransactionType } from '@finance/domain/enum';
import { ledgerDeltas } from '@finance/domain/service/LedgerBalance';
import { Database } from '@shared/infra/db/Database';
import { uuidV4 } from '@shared/infra/uuid';

// Account and category summaries come back in the same query (no N+1).
export const TRANSACTION_RELATIONS = {
  account: { select: { icon: true, id: true, name: true } },
  category: {
    select: {
      exclude_from_totals: true,
      icon: true,
      icon_color: true,
      id: true,
      name: true,
      system_key: true,
    },
  },
  credit_card: { select: { color: true, id: true, last_digits: true, title: true } },
  early_payment: { select: { credit_card_id: true, id: true, invoice_month: true } },
  installment_plan: { select: { installment_count: true } },
  paid_from_transaction: {
    select: { account: { select: { name: true } }, account_id: true },
  },
  recurrence: { select: { end_date: true, first_number: true, frequency: true, start_date: true } },
  refunded_plan: { select: { description: true } },
  refunded_transaction: { select: { description: true } },
  tags: TAG_INCLUDE.tags,
};

@Injectable()
export class FinanceTransactionDatasource implements IFinanceTransactionDatasource {
  constructor(private readonly db: Database) {}

  async countByAccountId(accountId: string): Promise<number> {
    return this.db.client.financialTransaction.count({ where: { account_id: accountId } });
  }

  async countByCategoryIds(categoryIds: string[]): Promise<number> {
    // A plan keeps its own category even when every installment was recategorized: it blocks the delete too.
    const [transactions, plans, series] = await Promise.all([
      this.db.client.financialTransaction.count({ where: { category_id: { in: categoryIds } } }),
      this.db.client.financialInstallmentPlan.count({
        where: { category_id: { in: categoryIds } },
      }),
      this.db.client.financialRecurrence.count({ where: { category_id: { in: categoryIds } } }),
    ]);
    return transactions + plans + series;
  }

  async countByCreditCardId(creditCardId: string): Promise<number> {
    return this.db.client.financialTransaction.count({ where: { credit_card_id: creditCardId } });
  }

  async countForExport(params: ExportTransactionsDatasourceParams): Promise<number> {
    return this.db.client.financialTransaction.count({ where: exportWhere(params) });
  }

  // The row and the ledger of its account change in ONE database transaction (spec 028).
  async create(
    params: CreateTransactionDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.$transaction(async (tx) => {
      await lockCards(tx, params.credit_card_id ? [params.credit_card_id] : []);
      await assertInvoiceNotPaid(tx, params.credit_card_id, params.invoice_month);
      const { tag_names: tagNames, ...data } = params;
      const created = await tx.financialTransaction.create({
        data,
        include: TRANSACTION_RELATIONS,
      });
      await applyLedgerDeltas(tx, ledgerDeltas(undefined, toLedgerEntry(created)));
      if (tagNames === undefined || tagNames.length === 0) {
        return created;
      }
      await applyTagNames(tx, {
        names: tagNames,
        owner: created.owner,
        ownerId: created.owner_id,
        where: { id: created.id },
      });
      return tx.financialTransaction.findUniqueOrThrow({
        include: TRANSACTION_RELATIONS,
        where: { id: created.id },
      });
    });
  }

  // Spec 047: every row, the ledger deltas (summed per account, ordered by id) and the tags in ONE database transaction.
  async createMany(rows: CreateTransactionDatasourceParams[]): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    return this.db.client.$transaction(
      async (tx) => {
        await lockCards(
          tx,
          rows.flatMap((row) => (row.credit_card_id ? [row.credit_card_id] : [])),
        );

        const invoices = new Map<string, { card: string; month: string }>();

        for (const row of rows) {
          if (row.credit_card_id && row.invoice_month) {
            invoices.set(`${row.credit_card_id}|${row.invoice_month}`, {
              card: row.credit_card_id,
              month: row.invoice_month,
            });
          }
        }

        for (const { card, month } of invoices.values()) {
          await assertInvoiceNotPaid(tx, card, month);
        }

        return insertRows(tx, rows);
      },
      { timeout: 30000 },
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockCards(tx, await this.cardsOf(tx, id));
      const stored = await lockTransactionRow(tx, id);
      if (!stored) {
        return;
      }
      await assertInvoiceNotPaid(tx, stored.creditCardId, stored.invoiceMonth);
      await tx.financialTransaction.deleteMany({ where: { id } });
      await applyLedgerDeltas(tx, ledgerDeltas(stored, undefined));
    });
  }

  async exists(params: ExistsTransactionDatasourceParams): Promise<boolean> {
    const found = await this.db.client.financialTransaction.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });
    return found !== null;
  }

  // Spec 047 FR 29: the rows a file could repeat, by their date range.
  async findById(id: string): Promise<FinancialTransactionWithRelations | null> {
    return this.db.client.financialTransaction.findUnique({
      include: TRANSACTION_RELATIONS,
      where: { id },
    });
  }

  async findDuplicateCandidates(params: {
    from: string;
    owner: OwnerType;
    owner_id: string;
    to: string;
  }): Promise<DuplicateCandidate[]> {
    return this.db.client.financialTransaction.findMany({
      select: {
        account_id: true,
        credit_card_id: true,
        date: true,
        description: true,
        type: true,
        value: true,
      },
      where: {
        date: { gte: fromCalendarDate(params.from), lte: fromCalendarDate(params.to) },
        owner: params.owner,
        owner_id: params.owner_id,
      },
    });
  }

  async findForExport(
    params: ExportTransactionsDatasourceParams,
  ): Promise<FinancialTransactionWithRelations[]> {
    return this.db.client.financialTransaction.findMany({
      include: TRANSACTION_RELATIONS,
      orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
      where: exportWhere(params),
    });
  }
  // Default source ACCOUNT: account rows without the invoice payment transactions (the paid invoice line stands for them).
  async findByOwners(
    owners: OwnerAccess[],
    source: TransactionSource = TransactionSource.ACCOUNT,
    filter: FindTransactionsFilter = {},
  ): Promise<FinancialTransactionWithRelations[]> {
    const sourceWhere =
      source === TransactionSource.CARD
        ? {
            credit_card_id: filter.creditCardIds?.length
              ? { in: filter.creditCardIds }
              : { not: null },
            invoice_month: filter.invoiceMonth,
          }
        : {
            // The account row of an early payment (it has a card row pointing at it) stays in the list.
            credit_card_id: null,
            OR: [
              { category: { system_key: null } },
              { category: { system_key: { not: SystemCategoryKey.INVOICE_PAYMENT } } },
              { early_payment: { isNot: null } },
            ],
          };
    return this.db.client.financialTransaction.findMany({
      include: TRANSACTION_RELATIONS,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      where: { AND: [toOwnerWhere(owners), sourceWhere, ...filterWhere(source, filter)] },
    });
  }

  async findCardPurchases(keys: CardInvoiceKey[]): Promise<FinancialTransactionWithRelations[]> {
    if (keys.length === 0) {
      return [];
    }
    return this.db.client.financialTransaction.findMany({
      include: TRANSACTION_RELATIONS,
      orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
      where: { OR: keys.map((key) => ({ ...key })) },
    });
  }
  // One grouped query for every card: the sum of each (card, invoice month).
  async sumCardInvoices(creditCardIds: string[]): Promise<CardInvoiceSum[]> {
    if (creditCardIds.length === 0) {
      return [];
    }
    const rows = await this.db.client.financialTransaction.groupBy({
      _sum: { value: true },
      by: ['credit_card_id', 'invoice_month', 'type', 'category_id'],
      where: { credit_card_id: { in: creditCardIds } },
    });
    const sums = new Map<string, CardInvoiceSum>();
    // Net = purchases (EXPENSE) minus every credit (INCOME); early payments are also counted apart.
    for (const row of rows) {
      const key = `${row.credit_card_id}|${row.invoice_month}`;
      const sum = sums.get(key) ?? {
        amount: 0,
        credit_card_id: row.credit_card_id as string,
        early_paid: 0,
        invoice_month: row.invoice_month as string,
      };
      const value = row._sum.value ?? 0;
      sum.amount += row.type === TransactionType.INCOME ? -value : value;
      if (row.category_id === SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_EARLY_PAYMENT]) {
        sum.early_paid += value;
      }
      sums.set(key, sum);
    }
    return [...sums.values()];
  }
  // Spec 046: one grouped query for the dashboard, in the database (never the rows in memory).
  async sumDashboardRows(params: DashboardSumsParams): Promise<DashboardSumRow[]> {
    if (params.owners.length === 0) {
      return [];
    }

    const sql = dashboardSumsSql(params);
    const rows = await this.db.client.$queryRaw<
      {
        amount: bigint;
        category_id: string;
        count: bigint;
        credit_card_id: null | string;
        date: null | string;
        invoice_month: null | string;
        paid: boolean | null;
        tag_id: null | string;
        type: TransactionType;
      }[]
    >(sql);

    return rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      count: Number(row.count),
    }));
  }

  // The old values come from the row locked INSIDE this transaction, never from an earlier read.
  private async cardsOf(tx: Parameters<typeof lockCards>[0], id: string): Promise<string[]> {
    const row = await tx.financialTransaction.findUnique({
      select: { credit_card_id: true },
      where: { id },
    });
    return row?.credit_card_id ? [row.credit_card_id] : [];
  }

  async update(
    params: UpdateTransactionDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.$transaction(async (tx) => {
      // Cards first, rows second: the same order as the invoice payment, so the two never deadlock.
      await lockCards(tx, [
        ...(await this.cardsOf(tx, params.id)),
        ...(params.credit_card_id ? [params.credit_card_id] : []),
      ]);
      const stored = await lockTransactionRow(tx, params.id);
      if (!stored) {
        throw new NotFoundException();
      }
      // In a paid invoice only the description and the category can change (spec 030 FR 16).
      if (!isTextOnly(params)) {
        await assertInvoiceNotPaid(tx, stored.creditCardId, stored.invoiceMonth);
        await assertInvoiceNotPaid(
          tx,
          params.credit_card_id === undefined ? stored.creditCardId : params.credit_card_id,
          params.invoice_month === undefined ? stored.invoiceMonth : params.invoice_month,
        );
      }
      const previousOwner =
        params.owner === undefined && params.owner_id === undefined
          ? undefined
          : await tx.financialTransaction.findUnique({
              select: { owner: true, owner_id: true },
              where: { id: params.id },
            });
      const updated = await tx.financialTransaction.update({
        data: {
          account_id: params.account_id,
          category_id: params.category_id,
          credit_card_id: params.credit_card_id,
          date: params.date,
          description: params.description,
          invoice_month: params.invoice_month,
          owner: params.owner,
          owner_id: params.owner_id,
          paid: params.paid,
          type: params.type,
          value: params.value,
        },
        include: TRANSACTION_RELATIONS,
        where: { id: params.id },
      });
      await applyLedgerDeltas(tx, ledgerDeltas(stored, toLedgerEntry(updated)));
      // Spec 043 FR 9/12: names replace the set; a new owner re-resolves the current names in that owner.
      const ownerChanged =
        Boolean(previousOwner) &&
        (updated.owner !== previousOwner?.owner || updated.owner_id !== previousOwner?.owner_id);
      const names =
        params.tag_names ?? (ownerChanged ? await tagNamesOfRow(tx, updated.id) : undefined);
      if (names === undefined) {
        return updated;
      }
      await applyTagNames(tx, {
        names,
        owner: updated.owner,
        ownerId: updated.owner_id,
        where: { id: updated.id },
      });
      return tx.financialTransaction.findUniqueOrThrow({
        include: TRANSACTION_RELATIONS,
        where: { id: updated.id },
      });
    });
  }
}
const ACCENTS = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
const PLAIN = 'aaaaaeeeeiiiiooooouuuucn';
// Money that only moves between the user's own places is not income or expense (spec 046 FR 7).
const DASHBOARD_EXCLUDED_KEYS = [
  SystemCategoryKey.BALANCE_ADJUSTMENT,
  SystemCategoryKey.CARD_EARLY_PAYMENT,
  SystemCategoryKey.INVOICE_PAYMENT,
];

function dashboardSumsSql(params: DashboardSumsParams): Prisma.Sql {
  const isCard = params.source === TransactionSource.CARD;
  const isAccount = params.source === undefined || params.source === TransactionSource.ACCOUNT;
  const withCard = (params.source === undefined || isCard) && params.invoice_refs.length > 0;
  const conditions: Prisma.Sql[] = [
    Prisma.sql`t."currency" = ${params.currency}`,
    Prisma.sql`(t."owner", t."owner_id") IN (${Prisma.join(
      params.owners.map((access) => Prisma.sql`(${access.owner}::"OwnerType", ${access.ownerId})`),
    )})`,
    Prisma.sql`(c."system_key" IS NULL OR c."system_key"::text NOT IN (${Prisma.join(DASHBOARD_EXCLUDED_KEYS)}))`,
  ];
  const sources: Prisma.Sql[] = [];

  if (isAccount) {
    sources.push(
      Prisma.sql`(t."credit_card_id" IS NULL AND t."date" >= ${params.from}::date AND t."date" <= ${params.to}::date${
        params.account_ids?.length
          ? Prisma.sql` AND t."account_id" IN (${Prisma.join(params.account_ids)})`
          : Prisma.empty
      })`,
    );
  }
  if (withCard) {
    sources.push(
      Prisma.sql`(t."credit_card_id" IS NOT NULL AND (t."credit_card_id", t."invoice_month") IN (${Prisma.join(
        params.invoice_refs.map((ref) => Prisma.sql`(${ref.credit_card_id}, ${ref.invoice_month})`),
      )})${
        params.credit_card_ids?.length
          ? Prisma.sql` AND t."credit_card_id" IN (${Prisma.join(params.credit_card_ids)})`
          : Prisma.empty
      })`,
    );
  }

  conditions.push(
    sources.length ? Prisma.sql`(${Prisma.join(sources, ' OR ')})` : Prisma.sql`FALSE`,
  );

  if (params.category_ids?.length) {
    conditions.push(Prisma.sql`t."category_id" IN (${Prisma.join(params.category_ids)})`);
  }
  if (params.tag_ids?.length) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "financial_transaction_tags" f WHERE f."transaction_id" = t."id" AND f."tag_id" IN (${Prisma.join(params.tag_ids)}))`,
    );
  }
  if (params.q) {
    const pattern = `%${params.q.replace(/[\\%_]/g, '\\$&')}%`;

    conditions.push(
      Prisma.sql`translate(lower(t."description"), ${ACCENTS}, ${PLAIN}) ILIKE translate(lower(${pattern}), ${ACCENTS}, ${PLAIN})`,
    );
  }

  const tagJoin = params.by_tag
    ? Prisma.sql`LEFT JOIN "financial_transaction_tags" tt ON tt."transaction_id" = t."id"`
    : Prisma.empty;
  const tagColumn = params.by_tag ? Prisma.sql`tt."tag_id"` : Prisma.sql`NULL::text`;

  return Prisma.sql`
    SELECT to_char(CASE WHEN t."credit_card_id" IS NULL THEN t."date" END, 'YYYY-MM-DD') AS "date", t."credit_card_id", t."invoice_month", t."type"::text AS "type",
      t."category_id", t."paid", ${tagColumn} AS "tag_id",
      COALESCE(SUM(t."value"), 0) AS "amount", COUNT(*) AS "count"
    FROM "financial_transactions" t
    JOIN "financial_categories" c ON c."id" = t."category_id"
    ${tagJoin}
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY 1, 2, 3, 4, 5, 6, 7`;
}

// Spec 045: the optional filters as extra AND conditions (none → the same query as before).
// Spec 047 FR 4: account rows by `date`, card purchases by their purchase `date`, system rows included.
function exportWhere(
  params: ExportTransactionsDatasourceParams,
): Prisma.FinancialTransactionWhereInput {
  const picked: Prisma.FinancialTransactionWhereInput[] = [];

  if (params.account_ids?.length) {
    picked.push({ account_id: { in: params.account_ids } });
  }

  if (params.credit_card_ids?.length) {
    picked.push({ credit_card_id: { in: params.credit_card_ids } });
  }

  return {
    AND: [
      toOwnerWhere(params.owners),
      { date: { gte: fromCalendarDate(params.from), lte: fromCalendarDate(params.to) } },
      ...(picked.length > 0 ? [{ OR: picked }] : []),
    ],
  };
}
function filterWhere(source: TransactionSource, filter: FindTransactionsFilter) {
  const where: Prisma.FinancialTransactionWhereInput[] = [];

  if (filter.categoryIds?.length) {
    where.push({ category_id: { in: filter.categoryIds } });
  }

  if (filter.tagIds?.length) {
    where.push({ tags: { some: { tag_id: { in: filter.tagIds } } } });
  }

  if (source === TransactionSource.CARD) {
    if (filter.invoiceRefs) {
      where.push({
        OR: filter.invoiceRefs.map((ref) => ({
          credit_card_id: ref.credit_card_id,
          invoice_month: ref.invoice_month,
        })),
      });
    }

    return where;
  }

  if (filter.accountIds?.length) {
    where.push({ account_id: { in: filter.accountIds } });
  }

  if (filter.paid !== undefined) {
    where.push({ paid: filter.paid });
  }

  if (filter.from && filter.to) {
    where.push({ date: { gte: fromCalendarDate(filter.from), lte: fromCalendarDate(filter.to) } });
  }

  return where;
}
function isTextOnly(params: UpdateTransactionDatasourceParams): boolean {
  return (
    params.account_id === undefined &&
    params.credit_card_id === undefined &&
    params.date === undefined &&
    params.invoice_month === undefined &&
    params.owner === undefined &&
    params.owner_id === undefined &&
    params.type === undefined &&
    params.value === undefined
  );
}
// Resolves every tag name once in the owner and links them to the new rows (position = index in the row).
async function tagCreatedRows(
  tx: Prisma.TransactionClient,
  first: CreateTransactionDatasourceParams,
  rows: { id: string; names: string[] }[],
): Promise<void> {
  const names = uniqueNames(rows.flatMap((row) => row.names));

  if (names.length === 0) {
    return;
  }

  const ids = await resolveTagIds(tx, { names, owner: first.owner, ownerId: first.owner_id });
  const byName = new Map(names.map((name, index) => [name.toLowerCase(), ids[index]]));

  await tx.financialTransactionTag.createMany({
    data: rows.flatMap((row) =>
      uniqueNames(row.names).map((name, position) => ({
        position,
        tag_id: byName.get(name.toLowerCase()) as string,
        transaction_id: row.id,
      })),
    ),
  });
}

// Writes the rows, applies the ledger once per account and tags the rows (spec 047). The caller holds the card
// locks and checked the invoices; spec 048 reuses this inside the import transaction.
export async function insertRows(
  tx: Prisma.TransactionClient,
  rows: CreateTransactionDatasourceParams[],
): Promise<number> {
  // Ids are generated here so each row is tied to its tags whatever order the database returns.
  const entries = rows.map((row) => {
    const { tag_names: names, ...data } = row;

    return { data: { ...data, id: uuidV4() }, names: names ?? [] };
  });
  const created = await tx.financialTransaction.createManyAndReturn({
    data: entries.map((entry) => entry.data),
    select: { account_id: true, paid: true, type: true, value: true },
  });
  const deltas = new Map<string, number>();

  for (const row of created) {
    for (const { accountId, delta } of ledgerDeltas(undefined, toLedgerEntry(row))) {
      deltas.set(accountId, (deltas.get(accountId) ?? 0) + delta);
    }
  }

  await applyLedgerDeltas(
    tx,
    [...deltas.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([accountId, delta]) => ({ accountId, delta })),
  );
  // Tags belong to the owner of their rows: one resolution per owner (spec 047, owner per row).
  const byOwner = new Map<string, typeof entries>();

  for (const entry of entries) {
    const key = `${entry.data.owner}|${entry.data.owner_id}`;

    byOwner.set(key, [...(byOwner.get(key) ?? []), entry]);
  }

  for (const group of byOwner.values()) {
    await tagCreatedRows(
      tx,
      group[0].data,
      group.map((entry) => ({ id: entry.data.id, names: entry.names })),
    );
  }

  return created.length;
}
