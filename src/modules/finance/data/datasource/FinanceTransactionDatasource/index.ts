import { Injectable, NotFoundException } from '@nestjs/common';

import { OwnerType, Prisma } from '@db/client';
import {
  invoiceTotalsKeysOf,
  refreshCardInvoiceTotals,
} from '@finance/data/datasource/cardInvoiceTotals';
import {
  applyLedgerDeltas,
  assertInvoiceNotPaid,
  lockCards,
  lockWriteScope,
  sumLedgerDeltas,
  toLedgerEntry,
} from '@finance/data/datasource/ledger';
import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import { relationLoadStrategyFor } from '@finance/data/datasource/relationLoadStrategy';
import {
  applyTagNames,
  resolveTagIds,
  TAG_INCLUDE,
  tagNamesOfRow,
  uniqueNames,
} from '@finance/data/datasource/tags';
import {
  CardInvoiceCount,
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
  ProjectedPurchaseRecord,
  TransactionScalarsRecord,
  UnpaidAccountRowRecord,
  UpdateTransactionDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SystemCategoryKey, TransactionSource, TransactionType } from '@finance/domain/enum';
import { ledgerDeltas } from '@finance/domain/service/LedgerBalance';
import { SearchTerms } from '@finance/domain/service/TransactionSearch';
import { Database } from '@shared/infra/db/Database';
import { uuidV4 } from '@shared/infra/uuid';

// Account and category summaries come back in the same query (no N+1). Bounded reads add
// `relationLoadStrategy: 'join'` (preview `relationJoins`): ONE SQL statement instead of one per relation.
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

// Spec 085: what the ledger and the tags need inside a write transaction; the full row (relations) is read after commit.
const WRITE_SELECT = {
  account_id: true,
  credit_card_id: true,
  id: true,
  invoice_month: true,
  owner: true,
  owner_id: true,
  paid: true,
  type: true,
  value: true,
} as const;

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

  // The row and the ledger of its account change in ONE database transaction (spec 028); the response row is read
  // after the commit, so the locks are not held across its relation reads (spec 085).
  async create(
    params: CreateTransactionDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    const id = await this.db.client.$transaction(async (tx) => {
      await lockCards(tx, params.credit_card_id ? [params.credit_card_id] : []);
      await assertInvoiceNotPaid(tx, params.credit_card_id, params.invoice_month);
      const { tag_names: tagNames, ...data } = params;
      const created = await tx.financialTransaction.create({ data, select: WRITE_SELECT });
      await applyLedgerDeltas(tx, ledgerDeltas(undefined, toLedgerEntry(created)));
      await refreshCardInvoiceTotals(tx, invoiceTotalsKeysOf([created]));
      if (tagNames !== undefined && tagNames.length > 0) {
        await applyTagNames(tx, {
          names: tagNames,
          owner: created.owner,
          ownerId: created.owner_id,
          where: { id: created.id },
        });
      }

      return created.id;
    });

    return this.readAfterCommit(id);
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
      const stored = await lockWriteScope(tx, { extraCardIds: [], rowId: id });
      if (!stored) {
        return;
      }
      await assertInvoiceNotPaid(tx, stored.creditCardId, stored.invoiceMonth);
      await tx.financialTransaction.deleteMany({ where: { id } });
      await applyLedgerDeltas(tx, ledgerDeltas(stored, undefined));
      await refreshCardInvoiceTotals(
        tx,
        invoiceTotalsKeysOf([
          { credit_card_id: stored.creditCardId, invoice_month: stored.invoiceMonth },
        ]),
      );
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
      relationLoadStrategy: 'join',
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
      orderBy: [{ date: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      where: exportWhere(params),
    });
  }

  // Spec 096 FR 10: scalars only, the list that explains why an invoice cannot be paid.
  async findProjectedByInvoice(
    creditCardId: string,
    invoiceMonth: string,
  ): Promise<ProjectedPurchaseRecord[]> {
    return this.db.client.financialTransaction.findMany({
      orderBy: [{ date: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      select: { date: true, description: true, id: true, recurrence_id: true, value: true },
      where: { credit_card_id: creditCardId, invoice_month: invoiceMonth, projected: true },
    });
  }

  async findScalarsById(id: string): Promise<null | TransactionScalarsRecord> {
    return this.db.client.financialTransaction.findUnique({
      relationLoadStrategy: 'join',
      select: {
        account_id: true,
        category: { select: { system_key: true } },
        category_id: true,
        credit_card_id: true,
        currency: true,
        date: true,
        external_lock: true,
        id: true,
        installment_number: true,
        installment_plan_id: true,
        invoice_month: true,
        occurrence_number: true,
        owner: true,
        owner_id: true,
        paid: true,
        projected: true,
        recurrence_id: true,
        type: true,
      },
      where: { id },
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
        : ACCOUNT_SOURCE_WHERE;
    // Spec 084: the text search runs in SQL first; the usual filters, order, cursor and page then apply to its ids.
    const searched = filter.search
      ? await this.matchingIds(listWindowSql(owners, source, filter), filter.search)
      : undefined;

    if (searched?.length === 0) {
      return [];
    }

    return this.db.client.financialTransaction.findMany({
      include: TRANSACTION_RELATIONS,
      // `id` breaks ties (rows imported or materialized together share date and created_at): a stable order.
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
      relationLoadStrategy: relationLoadStrategyFor(source, filter),
      ...(filter.limit === undefined ? {} : { take: filter.limit + 1 }),
      where: {
        AND: [
          toOwnerWhere(owners),
          sourceWhere,
          ...filterWhere(source, filter),
          ...(filter.cursor ? [afterCursorWhere(filter.cursor)] : []),
          ...(searched ? [{ id: { in: searched } }] : []),
        ],
      },
    });
  }

  // Spec 082: the unpaid account rows up to `to` (no lower bound) with scalars only, for /finance/upcoming.
  async findUnpaidAccountRows(
    owners: OwnerAccess[],
    to: string,
  ): Promise<UnpaidAccountRowRecord[]> {
    return this.db.client.financialTransaction.findMany({
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
      select: {
        account_id: true,
        category_id: true,
        currency: true,
        date: true,
        description: true,
        id: true,
        occurrence_number: true,
        owner: true,
        owner_id: true,
        recurrence_id: true,
        type: true,
        value: true,
      },
      where: {
        AND: [
          toOwnerWhere(owners),
          ACCOUNT_SOURCE_WHERE,
          {
            category: { exclude_from_totals: false },
            date: { lte: fromCalendarDate(to) },
            paid: false,
          },
        ],
      },
    });
  }

  // Spec 082: how many rows (any type) each (card, invoice month) holds, without loading them.
  async countCardPurchases(keys: CardInvoiceKey[]): Promise<CardInvoiceCount[]> {
    if (keys.length === 0) {
      return [];
    }
    const rows = await this.db.client.financialTransaction.groupBy({
      _count: { _all: true },
      by: ['credit_card_id', 'invoice_month'],
      where: { OR: keys.map((key) => ({ ...key })) },
    });

    return rows.map((row) => ({
      count: row._count._all,
      credit_card_id: row.credit_card_id as string,
      invoice_month: row.invoice_month as string,
    }));
  }

  async findCardPurchases(
    keys: CardInvoiceKey[],
    search?: SearchTerms,
  ): Promise<FinancialTransactionWithRelations[]> {
    if (keys.length === 0) {
      return [];
    }
    const byKeys = { OR: keys.map((key) => ({ ...key })) };

    if (!search) {
      return this.db.client.financialTransaction.findMany({
        include: TRANSACTION_RELATIONS,
        orderBy: [{ date: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
        relationLoadStrategy: 'join',
        where: byKeys,
      });
    }

    // Spec 084: only the purchases matching the text, category ids or amount range.
    const ids = await this.matchingIds(invoiceKeysSql(keys), search);

    if (ids.length === 0) {
      return [];
    }
    return this.db.client.financialTransaction.findMany({
      include: TRANSACTION_RELATIONS,
      orderBy: [{ date: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      relationLoadStrategy: 'join',
      where: { AND: [byKeys, { id: { in: ids } }] },
    });
  }

  // Spec 084: ids of the rows of `window` matching the search (parameters only, nothing interpolated).
  private async matchingIds(window: Prisma.Sql, search: SearchTerms): Promise<string[]> {
    const rows = await this.db.client.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT t."id" FROM "financial_transactions" t WHERE ${window} AND ${searchSql(search)}`,
    );

    return rows.map((row) => row.id);
  }
  // Spec 091: the stored totals of each (card, invoice month) from `financial_card_invoice_totals` (one row per invoice
  // with purchases, kept by every card-row write, spec 090), never a grouping of the card history.
  // NET = purchases (EXPENSE) minus every credit (INCOME); early payments are also counted apart.
  async findInvoiceTotals(creditCardIds: string[]): Promise<CardInvoiceSum[]> {
    if (creditCardIds.length === 0) {
      return [];
    }
    const rows = await this.db.client.financialCardInvoiceTotal.findMany({
      orderBy: [{ credit_card_id: 'asc' }, { invoice_month: 'asc' }],
      select: {
        credit_card_id: true,
        early_paid: true,
        expense: true,
        income: true,
        invoice_month: true,
        projected_amount: true,
        projected_count: true,
      },
      where: { credit_card_id: { in: creditCardIds } },
    });

    return rows.map((row) => ({
      amount: row.expense - row.income,
      credit_card_id: row.credit_card_id,
      early_paid: row.early_paid,
      invoice_month: row.invoice_month,
      projected_amount: row.projected_amount,
      projected_count: row.projected_count,
    }));
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
        projected: boolean;
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

  async update(
    params: UpdateTransactionDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    await this.db.client.$transaction(async (tx) => {
      // Cards first, the row second (one statement): the same order as the invoice payment, so the two never deadlock.
      const stored = await lockWriteScope(tx, {
        extraCardIds: params.credit_card_id ? [params.credit_card_id] : [],
        rowId: params.id,
      });
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
      const updated = await tx.financialTransaction.update({
        data: {
          account_id: params.account_id,
          category_id: params.category_id,
          credit_card_id: params.credit_card_id,
          date: params.date,
          description: params.description,
          invoice_month: params.invoice_month,
          notes: params.notes,
          owner: params.owner,
          owner_id: params.owner_id,
          paid: params.paid,
          projected: params.projected,
          type: params.type,
          value: params.value,
        },
        select: WRITE_SELECT,
        where: { id: params.id },
      });
      await applyLedgerDeltas(tx, ledgerDeltas(stored, toLedgerEntry(updated)));
      await refreshCardInvoiceTotals(
        tx,
        invoiceTotalsKeysOf([
          { credit_card_id: stored.creditCardId, invoice_month: stored.invoiceMonth },
          updated,
        ]),
      );
      // Spec 043 FR 9/12: names replace the set; a new owner re-resolves the current names in that owner.
      const ownerChanged = updated.owner !== stored.owner || updated.owner_id !== stored.ownerId;
      const names =
        params.tag_names ?? (ownerChanged ? await tagNamesOfRow(tx, updated.id) : undefined);
      if (names === undefined) {
        return;
      }
      await applyTagNames(tx, {
        names,
        owner: updated.owner,
        ownerId: updated.owner_id,
        where: { id: updated.id },
      });
    });

    return this.readAfterCommit(params.id);
  }

  // The response of a write: the row with its relations (one join read), after the locks were released.
  private async readAfterCommit(id: string): Promise<FinancialTransactionWithRelations> {
    const row = await this.findById(id);
    if (!row) {
      throw new NotFoundException();
    }

    return row;
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

// Case- and accent-insensitive LIKE of a column against an already escaped pattern.
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
    // Specs 098 and 102: transfer sides and investment operations move balances but are not income or expense.
    Prisma.sql`c."exclude_from_totals" = false`,
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

  // Spec 052 FR 6: a row counts only before the archive day of its source (the card for card rows, else the account).
  conditions.push(
    Prisma.sql`(CASE WHEN cc."id" IS NOT NULL THEN cc."archived_at" ELSE a."archived_at" END IS NULL OR t."date" < ((CASE WHEN cc."id" IS NOT NULL THEN cc."archived_at" ELSE a."archived_at" END) AT TIME ZONE 'America/Sao_Paulo')::date)`,
  );
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
    // Spec 059 FR 14: description, notes, category (the ids already include the descendants) or amount.
    conditions.push(
      searchSql({
        amountMax: params.amount_max,
        amountMin: params.amount_min,
        categoryIds: params.search_category_ids ?? [],
        text: params.q,
      }),
    );
  }

  const tagJoin = params.by_tag
    ? Prisma.sql`LEFT JOIN "financial_transaction_tags" tt ON tt."transaction_id" = t."id"`
    : Prisma.empty;
  const tagColumn = params.by_tag ? Prisma.sql`tt."tag_id"` : Prisma.sql`NULL::text`;

  return Prisma.sql`
    SELECT to_char(CASE WHEN t."credit_card_id" IS NULL THEN t."date" END, 'YYYY-MM-DD') AS "date", t."credit_card_id", t."invoice_month", t."type"::text AS "type",
      t."category_id", t."paid", ${tagColumn} AS "tag_id", t."projected",
      COALESCE(SUM(t."value"), 0) AS "amount", COUNT(*) AS "count"
    FROM "financial_transactions" t
    JOIN "financial_categories" c ON c."id" = t."category_id"
    LEFT JOIN "financial_accounts" a ON a."id" = t."account_id"
    LEFT JOIN "financial_credit_cards" cc ON cc."id" = t."credit_card_id"
    ${tagJoin}
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8`;
}
// Spec 059 FR 14 / spec 084: description or notes (case and accent insensitive), category ids, or amount range.
function searchSql(search: SearchTerms): Prisma.Sql {
  const pattern = `%${search.text.trim().replace(/[\\%_]/g, '\\$&')}%`;
  const matchers = [
    foldedLike(Prisma.sql`t."description"`, pattern),
    foldedLike(Prisma.sql`COALESCE(t."notes", '')`, pattern),
  ];

  if (search.categoryIds.length) {
    matchers.push(Prisma.sql`t."category_id" IN (${Prisma.join(search.categoryIds)})`);
  }
  if (search.amountMin !== undefined && search.amountMax !== undefined) {
    matchers.push(Prisma.sql`ABS(t."value") BETWEEN ${search.amountMin} AND ${search.amountMax}`);
  }

  return Prisma.sql`(${Prisma.join(matchers, ' OR ')})`;
}
// The rows of these (card, invoice month) pairs.
function invoiceKeysSql(keys: CardInvoiceKey[]): Prisma.Sql {
  return Prisma.sql`(t."credit_card_id", t."invoice_month") IN (${Prisma.join(
    keys.map((key) => Prisma.sql`(${key.credit_card_id}, ${key.invoice_month})`),
  )})`;
}
// The coarse part of the list filters (owners, source, period or invoices); Prisma applies the exact ones afterwards.
function foldedLike(column: Prisma.Sql, pattern: string): Prisma.Sql {
  return Prisma.sql`translate(lower(${column}), ${ACCENTS}, ${PLAIN}) ILIKE translate(lower(${pattern}), ${ACCENTS}, ${PLAIN})`;
}
function listWindowSql(
  owners: OwnerAccess[],
  source: TransactionSource,
  filter: FindTransactionsFilter,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`(t."owner", t."owner_id") IN (${Prisma.join(
      owners.map((access) => Prisma.sql`(${access.owner}::"OwnerType", ${access.ownerId})`),
    )})`,
  ];

  if (source === TransactionSource.CARD) {
    conditions.push(
      filter.creditCardIds?.length
        ? Prisma.sql`t."credit_card_id" IN (${Prisma.join(filter.creditCardIds)})`
        : Prisma.sql`t."credit_card_id" IS NOT NULL`,
    );
    if (filter.invoiceMonth !== undefined) {
      conditions.push(Prisma.sql`t."invoice_month" = ${filter.invoiceMonth}`);
    }
    if (filter.invoiceRefs?.length) {
      conditions.push(invoiceKeysSql(filter.invoiceRefs));
    }
  } else {
    conditions.push(Prisma.sql`t."credit_card_id" IS NULL`);
    if (filter.from && filter.to) {
      conditions.push(
        Prisma.sql`t."date" >= ${filter.from}::date AND t."date" <= ${filter.to}::date`,
      );
    }
  }

  return Prisma.join(conditions, ' AND ');
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
      // Spec 096 FR 13: a projected purchase is not a real charge yet.
      { projected: false },
    ],
  };
}
// The account side of the list: an early payment's account row (it has a card row pointing at it) stays in.
const ACCOUNT_SOURCE_WHERE = {
  credit_card_id: null,
  OR: [
    { category: { system_key: null } },
    { category: { system_key: { not: SystemCategoryKey.INVOICE_PAYMENT } } },
    { early_payment: { isNot: null } },
  ],
};
// Rows strictly after the cursor in the (date, created_at, id) descending order.
function afterCursorWhere(cursor: NonNullable<FindTransactionsFilter['cursor']>) {
  return {
    OR: [
      { date: { lt: cursor.date } },
      { created_at: { lt: cursor.createdAt }, date: cursor.date },
      { created_at: cursor.createdAt, date: cursor.date, id: { lt: cursor.id } },
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

  if (filter.projected !== undefined) {
    where.push({ projected: filter.projected });
  }

  // Spec 103: the currency of the row, for account and card rows alike.
  if (filter.currency) {
    where.push({ currency: filter.currency });
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

  if (filter.kind === 'TRANSFER') {
    where.push({ transfer_id: { not: null } });
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
    params.projected === undefined &&
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
    select: {
      account_id: true,
      credit_card_id: true,
      invoice_month: true,
      paid: true,
      type: true,
      value: true,
    },
  });

  await applyLedgerDeltas(
    tx,
    sumLedgerDeltas(created.flatMap((row) => ledgerDeltas(undefined, toLedgerEntry(row)))),
  );
  await refreshCardInvoiceTotals(tx, invoiceTotalsKeysOf(created));
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
