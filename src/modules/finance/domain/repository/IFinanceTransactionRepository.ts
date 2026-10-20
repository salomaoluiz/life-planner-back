import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionSource, TransactionType } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceTransactionRepository = {
  countByAccountId(accountId: string): Promise<number>;
  countByCategoryIds(categoryIds: string[]): Promise<number>;
  countByCreditCardId(creditCardId: string): Promise<number>;
  createTransaction(params: CreateTransactionRepositoryParams): Promise<TransactionEntity>;
  deleteTransaction(id: string): Promise<void>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findTransactionById(id: string): Promise<TransactionEntity | undefined>;
  // Sorted by `date` descending, then `createdAt` descending.
  findCardPurchases(keys: CardInvoiceRef[]): Promise<TransactionEntity[]>;
  // Default source ACCOUNT: account rows only, without the invoice payment transactions.
  findTransactions(
    owners: OwnerAccess[],
    source?: TransactionSource,
    filter?: { creditCardId?: string; invoiceMonth?: string },
  ): Promise<TransactionEntity[]>;
  // One grouped query: the sum of every (card, invoice month).
  sumCardInvoices(creditCardIds: string[]): Promise<CardInvoiceTotal[]>;
  updateTransaction(params: UpdateTransactionRepositoryParams): Promise<TransactionEntity>;
};

interface CardInvoiceRef {
  creditCardId: string;
  invoiceMonth: string;
}
interface CardInvoiceTotal extends CardInvoiceRef {
  // NET: purchases minus credits.
  amount: number;
  earlyPaid: number;
}
interface CreateTransactionRepositoryParams {
  accountId?: string;
  categoryId: string;
  creditCardId?: string;
  currency: CurrencyCode;
  date: string;
  description: string;
  invoiceMonth?: string;
  owner: OwnerType;
  ownerId: string;
  // Account rows only; omitted for card rows.
  paid?: boolean;
  type: TransactionType;
  value: number;
}
interface UpdateTransactionRepositoryParams {
  accountId?: null | string;
  categoryId?: string;
  creditCardId?: null | string;
  date?: string;
  description?: string;
  id: string;
  invoiceMonth?: null | string;
  owner?: OwnerType;
  ownerId?: string;
  // true/false on account rows, null when the row moves to a card.
  paid?: boolean | null;
  type?: TransactionType;
  value?: number;
}

export {
  CardInvoiceRef,
  CardInvoiceTotal,
  CreateTransactionRepositoryParams,
  UpdateTransactionRepositoryParams,
};
