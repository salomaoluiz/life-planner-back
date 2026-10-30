import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionSource, TransactionType } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceTransactionRepository = {
  countByAccountId(accountId: string): Promise<number>;
  countByCategoryIds(categoryIds: string[]): Promise<number>;
  countByCreditCardId(creditCardId: string): Promise<number>;
  countTransactionsForExport(query: ExportQuery): Promise<number>;
  // Spec 047: every row in ONE database transaction (all or none); returns how many were written.
  createManyTransactions(rows: CreateTransactionRepositoryParams[]): Promise<number>;
  createTransaction(params: CreateTransactionRepositoryParams): Promise<TransactionEntity>;
  deleteTransaction(id: string): Promise<void>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findDuplicateCandidates(query: DuplicateQuery): Promise<DuplicateCandidate[]>;
  findTransactionById(id: string): Promise<TransactionEntity | undefined>;
  // Spec 047: every row of the period by its own date (system rows included), `date` then `createdAt` ascending.
  findTransactionsForExport(query: ExportQuery): Promise<TransactionEntity[]>;
  // Sorted by `date` descending, then `createdAt` descending.
  findCardPurchases(keys: CardInvoiceRef[]): Promise<TransactionEntity[]>;
  // Default source ACCOUNT: account rows only, without the invoice payment transactions.
  findTransactions(
    owners: OwnerAccess[],
    source?: TransactionSource,
    filter?: TransactionQuery,
  ): Promise<TransactionEntity[]>;
  // Spec 046: grouped sums for the dashboard (system categories that only move money are left out).
  sumDashboardRows(query: DashboardSumsQuery): Promise<DashboardSum[]>;
  // One grouped query: the sum of every (card, invoice month).
  sumCardInvoices(creditCardIds: string[]): Promise<CardInvoiceTotal[]>;
  updateTransaction(params: UpdateTransactionRepositoryParams): Promise<TransactionEntity>;
};

// Account rows are bounded by `from`/`to` (their date); card rows by `invoiceRefs`, which the use case picks by
// the date each invoice counts on. With `byTag` every row repeats once per tag (`tagId` null = no tag), else `tagId` is always null.
interface CardInvoiceRef {
  creditCardId: string;
  invoiceMonth: string;
}
interface DuplicateCandidate {
  accountId: null | string;
  creditCardId: null | string;
  // `YYYY-MM-DD`
  date: string;
  description: string;
  type: TransactionType;
  value: number;
}
interface DuplicateQuery {
  from: string;
  owner: OwnerAccess;
  to: string;
}
// A row matches when its account OR card is in the lists; with neither list every row of the owners matches.
interface CardInvoiceTotal extends CardInvoiceRef {
  // NET: purchases minus credits.
  amount: number;
  earlyPaid: number;
}
interface DashboardSum {
  amount: number;
  categoryId: string;
  count: number;
  creditCardId: null | string;
  // `YYYY-MM-DD` of account rows, null for card rows.
  date: null | string;
  invoiceMonth: null | string;
  // Account rows only.
  paid: boolean | null;
  tagId: null | string;
  type: TransactionType;
}
interface DashboardSumsQuery {
  accountIds?: string[];
  // Spec 059: an amount-like `q` also matches rows whose absolute value (cents) is in the range.
  amountRange?: { maxCents: number; minCents: number };
  byTag: boolean;
  categoryIds?: string[];
  creditCardIds?: string[];
  currency: CurrencyCode;
  from: string;
  // The invoices whose card rows count; none → no card rows.
  invoiceRefs: CardInvoiceRef[];
  owners: OwnerAccess[];
  // Case and accent insensitive match on the description and notes (plus the two fields around it).
  q?: string;
  // Spec 059: categories whose name (or an ancestor's) matches `q`.
  searchCategoryIds?: string[];
  source?: TransactionSource;
  tagIds?: string[];
  to: string;
}
interface ExportQuery {
  accountIds?: string[];
  creditCardIds?: string[];
  from: string;
  owners: OwnerAccess[];
  to: string;
}
// Spec 045: `from`/`to` bound the date of ACCOUNT rows; CARD rows are bounded by `invoiceRefs` (list-date rule).
interface CreateTransactionRepositoryParams {
  accountId?: string;
  categoryId: string;
  creditCardId?: string;
  currency: CurrencyCode;
  date: string;
  description: string;
  invoiceMonth?: string;
  notes?: null | string;
  owner: OwnerType;
  ownerId: string;
  // Account rows only; omitted for card rows.
  paid?: boolean;
  // Spec 043: tag names, resolved (or created) in the owner inside the write.
  tags?: string[];
  type: TransactionType;
  value: number;
}
interface TransactionQuery {
  accountIds?: string[];
  categoryIds?: string[];
  creditCardIds?: string[];
  from?: string;
  invoiceMonth?: string;
  invoiceRefs?: CardInvoiceRef[];
  // Account rows only: card rows derive it from their invoice.
  paid?: boolean;
  tagIds?: string[];
  to?: string;
}
interface UpdateTransactionRepositoryParams {
  accountId?: null | string;
  categoryId?: string;
  creditCardId?: null | string;
  date?: string;
  description?: string;
  id: string;
  invoiceMonth?: null | string;
  notes?: null | string;
  owner?: OwnerType;
  ownerId?: string;
  // true/false on account rows, null when the row moves to a card.
  paid?: boolean | null;
  // `undefined` leaves the tags untouched, `[]` removes them all.
  tags?: string[];
  type?: TransactionType;
  value?: number;
}

export {
  CardInvoiceRef,
  CardInvoiceTotal,
  CreateTransactionRepositoryParams,
  DashboardSum,
  DashboardSumsQuery,
  DuplicateCandidate,
  DuplicateQuery,
  ExportQuery,
  TransactionQuery,
  UpdateTransactionRepositoryParams,
};
