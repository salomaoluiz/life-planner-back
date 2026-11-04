import {
  FinancialAccount,
  FinancialCategory,
  FinancialCreditCard,
  FinancialInstallmentPlan,
  FinancialRecurrence,
  FinancialTransaction,
  OwnerType,
  TransactionType,
} from '@db/client';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { TransactionSource } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { SearchTerms } from '@finance/domain/service/TransactionSearch';

export interface CardInvoiceCount extends CardInvoiceKey {
  count: number;
}
export interface CardInvoiceKey {
  credit_card_id: string;
  invoice_month: string;
}
export interface CardInvoiceSum extends CardInvoiceKey {
  // NET: purchases minus credits.
  amount: number;
  early_paid: number;
}
export interface CreateTransactionDatasourceParams {
  account_id?: null | string;
  category_id: string;
  credit_card_id?: null | string;
  currency: CurrencyCode;
  date: Date;
  description: string;
  invoice_month?: null | string;
  notes?: null | string;
  owner: OwnerType;
  owner_id: string;
  // Account rows only (spec 033); card rows stay NULL.
  paid?: boolean | null;
  tag_names?: string[];
  type: TransactionType;
  value: number;
}
export interface DashboardSumRow {
  amount: number;
  category_id: string;
  count: number;
  credit_card_id: null | string;
  date: null | string;
  invoice_month: null | string;
  paid: boolean | null;
  tag_id: null | string;
  type: TransactionType;
}
export interface DashboardSumsParams {
  account_ids?: string[];
  amount_max?: number;
  amount_min?: number;
  by_tag: boolean;
  category_ids?: string[];
  credit_card_ids?: string[];
  currency: CurrencyCode;
  from: string;
  invoice_refs: CardInvoiceKey[];
  owners: OwnerAccess[];
  q?: string;
  search_category_ids?: string[];
  source?: TransactionSource;
  tag_ids?: string[];
  to: string;
}
// Spec 047: every row (system rows included) of the owners dated within the period; a row of a chosen account or card.
export interface DuplicateCandidate {
  account_id: null | string;
  credit_card_id: null | string;
  date: Date;
  description: string;
  type: TransactionType;
  value: number;
}
export interface ExistsTransactionDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface ExportTransactionsDatasourceParams {
  account_ids?: string[];
  credit_card_ids?: string[];
  from: string;
  owners: OwnerAccess[];
  to: string;
}
export type FinancialTransactionWithRelations = {
  account: null | Pick<FinancialAccount, 'icon' | 'id' | 'name'>;
  category: Pick<
    FinancialCategory,
    'exclude_from_totals' | 'icon_color' | 'icon' | 'id' | 'name' | 'system_key'
  >;
  credit_card: null | Pick<FinancialCreditCard, 'color' | 'id' | 'last_digits' | 'title'>;
  early_payment: null | Pick<FinancialTransaction, 'credit_card_id' | 'id' | 'invoice_month'>;
  installment_plan: null | Pick<FinancialInstallmentPlan, 'installment_count'>;
  paid_from_transaction: {
    account: null | Pick<FinancialAccount, 'name'>;
    account_id: null | string;
  } | null;
  recurrence: null | Pick<
    FinancialRecurrence,
    'end_date' | 'first_number' | 'frequency' | 'start_date'
  >;
  refunded_plan: null | Pick<FinancialInstallmentPlan, 'description'>;
  refunded_transaction: null | Pick<FinancialTransaction, 'description'>;
  // Spec 043: present on every read through TRANSACTION_RELATIONS, in the stored order.
  tags?: { tag: { id: string; name: string } }[];
} & FinancialTransaction;
// Spec 082: the scalars /finance/upcoming needs from an unpaid account row.
export interface FindTransactionsFilter {
  accountIds?: string[];
  categoryIds?: string[];
  creditCardIds?: string[];
  // Spec 078: keyset position (rows strictly after it in the list order) and page size (`limit + 1` rows are read).
  cursor?: { createdAt: Date; date: Date; id: string };
  from?: string;
  invoiceMonth?: string;
  invoiceRefs?: CardInvoiceKey[];
  limit?: number;
  paid?: boolean;
  search?: SearchTerms;
  tagIds?: string[];
  to?: string;
}
export interface IFinanceTransactionDatasource {
  countByAccountId(accountId: string): Promise<number>;
  countByCategoryIds(categoryIds: string[]): Promise<number>;
  countByCreditCardId(creditCardId: string): Promise<number>;
  countForExport(params: ExportTransactionsDatasourceParams): Promise<number>;
  create(params: CreateTransactionDatasourceParams): Promise<FinancialTransactionWithRelations>;
  // Spec 047: all rows in ONE database transaction (ledger and tags included); returns how many were written.
  countCardPurchases(keys: CardInvoiceKey[]): Promise<CardInvoiceCount[]>;
  createMany(rows: CreateTransactionDatasourceParams[]): Promise<number>;
  delete(id: string): Promise<void>;
  exists(params: ExistsTransactionDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<FinancialTransactionWithRelations | null>;
  findByOwners(
    owners: OwnerAccess[],
    source?: TransactionSource,
    filter?: FindTransactionsFilter,
  ): Promise<FinancialTransactionWithRelations[]>;
  findCardPurchases(
    keys: CardInvoiceKey[],
    search?: SearchTerms,
  ): Promise<FinancialTransactionWithRelations[]>;
  findDuplicateCandidates(params: {
    from: string;
    owner: OwnerType;
    owner_id: string;
    to: string;
  }): Promise<DuplicateCandidate[]>;
  findForExport(
    params: ExportTransactionsDatasourceParams,
  ): Promise<FinancialTransactionWithRelations[]>;
  findScalarsById(id: string): Promise<null | TransactionScalarsRecord>;
  findUnpaidAccountRows(owners: OwnerAccess[], to: string): Promise<UnpaidAccountRowRecord[]>;
  sumCardInvoices(creditCardIds: string[]): Promise<CardInvoiceSum[]>;
  sumDashboardRows(params: DashboardSumsParams): Promise<DashboardSumRow[]>;
  update(params: UpdateTransactionDatasourceParams): Promise<FinancialTransactionWithRelations>;
}
export type TransactionScalarsRecord = { category: { system_key: null | string } } & Pick<
  FinancialTransaction,
  | 'account_id'
  | 'category_id'
  | 'credit_card_id'
  | 'currency'
  | 'date'
  | 'id'
  | 'installment_number'
  | 'installment_plan_id'
  | 'invoice_month'
  | 'occurrence_number'
  | 'owner_id'
  | 'owner'
  | 'paid'
  | 'recurrence_id'
  | 'type'
>;
export type UnpaidAccountRowRecord = Pick<
  FinancialTransaction,
  | 'account_id'
  | 'category_id'
  | 'currency'
  | 'date'
  | 'description'
  | 'id'
  | 'occurrence_number'
  | 'owner_id'
  | 'owner'
  | 'recurrence_id'
  | 'type'
  | 'value'
>;
export interface UpdateTransactionDatasourceParams {
  account_id?: null | string;
  category_id?: string;
  credit_card_id?: null | string;
  date?: Date;
  description?: string;
  id: string;
  invoice_month?: null | string;
  notes?: null | string;
  owner?: OwnerType;
  owner_id?: string;
  // true/false on account rows, null when the row moves to a card (spec 033).
  paid?: boolean | null;
  tag_names?: string[];
  type?: TransactionType;
  value?: number;
}
