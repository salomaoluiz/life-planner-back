import {
  FinancialAccount,
  FinancialCategory,
  FinancialCreditCard,
  FinancialTransaction,
  OwnerType,
  TransactionType,
} from '@db/client';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { TransactionSource } from '@finance/domain/enum';

export interface CardInvoiceKey {
  credit_card_id: string;
  invoice_month: string;
}
export interface CardInvoiceSum extends CardInvoiceKey {
  amount: number;
}
export interface CreateTransactionDatasourceParams {
  account_id?: null | string;
  category_id: string;
  credit_card_id?: null | string;
  date: Date;
  description: string;
  invoice_month?: null | string;
  owner: OwnerType;
  owner_id: string;
  type: TransactionType;
  value: number;
}
export interface ExistsTransactionDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export type FinancialTransactionWithRelations = {
  account: null | Pick<FinancialAccount, 'icon' | 'id' | 'name'>;
  category: Pick<
    FinancialCategory,
    'exclude_from_totals' | 'icon_color' | 'icon' | 'id' | 'name' | 'system_key'
  >;
  credit_card: null | Pick<FinancialCreditCard, 'color' | 'id' | 'last_digits' | 'title'>;
} & FinancialTransaction;
export interface FindTransactionsFilter {
  creditCardId?: string;
  invoiceMonth?: string;
}
export interface IFinanceTransactionDatasource {
  countByAccountId(accountId: string): Promise<number>;
  countByCategoryIds(categoryIds: string[]): Promise<number>;
  countByCreditCardId(creditCardId: string): Promise<number>;
  create(params: CreateTransactionDatasourceParams): Promise<FinancialTransactionWithRelations>;
  delete(id: string): Promise<void>;
  exists(params: ExistsTransactionDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<FinancialTransactionWithRelations | null>;
  findByOwners(
    owners: OwnerAccess[],
    source?: TransactionSource,
    filter?: FindTransactionsFilter,
  ): Promise<FinancialTransactionWithRelations[]>;
  findCardPurchases(keys: CardInvoiceKey[]): Promise<FinancialTransactionWithRelations[]>;
  sumCardInvoices(creditCardIds: string[]): Promise<CardInvoiceSum[]>;
  update(params: UpdateTransactionDatasourceParams): Promise<FinancialTransactionWithRelations>;
}
export interface UpdateTransactionDatasourceParams {
  account_id?: null | string;
  category_id?: string;
  credit_card_id?: null | string;
  date?: Date;
  description?: string;
  id: string;
  invoice_month?: null | string;
  owner?: OwnerType;
  owner_id?: string;
  type?: TransactionType;
  value?: number;
}
