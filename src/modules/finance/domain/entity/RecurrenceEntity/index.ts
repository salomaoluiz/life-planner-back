import { TagRef } from '@finance/domain/entity/TagEntity';
import {
  TransactionAccountSummary,
  TransactionCardSummary,
  TransactionCategorySummary,
} from '@finance/domain/entity/TransactionEntity';
import { RecurrenceFrequency, RecurrenceStatus, TransactionType } from '@finance/domain/enum';
import { CurrencyCode, DEFAULT_CURRENCY } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

interface IRecurrenceEntity {
  account: null | TransactionAccountSummary;
  accountId: null | string;
  // Spec 098: only for a transfer series (`value` is then the amount out).
  amountIn?: null | number;
  category: TransactionCategorySummary;
  categoryId: string;
  createdAt: Date;
  creditCard: null | TransactionCardSummary;
  creditCardId: null | string;
  currency?: CurrencyCode;
  description: string;
  endDate: null | string;
  firstNumber: number;
  frequency: RecurrenceFrequency;
  id: string;
  lastGeneratedNumber: number;
  nextOccurrenceDate: null | string;
  notes?: null | string;
  occurrenceCount: null | number;
  owner: OwnerType;
  ownerId: string;
  projected?: boolean;
  skippedNumbers: number[];
  startDate: string;
  status: RecurrenceStatus;
  tags?: TagRef[];
  toAccount?: null | TransactionAccountSummary;
  toAccountId?: null | string;
  type: TransactionType;
  updatedAt: Date;
  value: number;
}

// A recurring series (spec 034): the template of its transactions plus the schedule. Real rows are
// `TransactionEntity` with `recurrenceId`; later occurrences are projected by `RecurrenceSchedule`.
class RecurrenceEntity {
  account: null | TransactionAccountSummary;
  accountId: null | string;
  // Transfer series with the same currency on both sides: the fixed amount in (null otherwise).
  amountIn: null | number;
  category: TransactionCategorySummary;
  categoryId: string;
  createdAt: Date;
  creditCard: null | TransactionCardSummary;
  creditCardId: null | string;
  currency: CurrencyCode;
  description: string;
  notes: null | string;
  // Inclusive; null = runs until the user ends it.
  endDate: null | string;
  // Number of occurrence 1 of this series (> 1 after a split).
  firstNumber: number;
  frequency: RecurrenceFrequency;
  id: string;
  // Position (1-based, inside the series) of the last occurrence already materialized, deleted ones included.
  lastGeneratedNumber: number;
  nextOccurrenceDate: null | string;
  // Total shown as `k/n` (`firstNumber - 1 + count until endDate`); null without an end date.
  occurrenceCount: null | number;
  owner: OwnerType;
  ownerId: string;
  // Spec 096: every occurrence of the (card EXPENSE) series is born projected.
  projected: boolean;
  // Occurrence NUMBERS (as displayed) of projected occurrences deleted alone.
  skippedNumbers: number[];
  startDate: string;
  status: RecurrenceStatus;
  // Spec 043: the tags the occurrences of the series get, in the stored order.
  tags: TagRef[];
  // Spec 098: set = transfer series from `accountId` to `toAccountId`.
  toAccount: null | TransactionAccountSummary;
  toAccountId: null | string;
  type: TransactionType;
  updatedAt: Date;
  // Integer cents, always > 0.
  value: number;

  constructor(params: IRecurrenceEntity) {
    this.account = params.account;
    this.accountId = params.accountId;
    this.amountIn = params.amountIn ?? null;
    this.category = params.category;
    this.categoryId = params.categoryId;
    this.createdAt = params.createdAt;
    this.creditCard = params.creditCard;
    this.creditCardId = params.creditCardId;
    this.currency = params.currency ?? DEFAULT_CURRENCY;
    this.description = params.description;
    this.notes = params.notes ?? null;
    this.endDate = params.endDate;
    this.firstNumber = params.firstNumber;
    this.frequency = params.frequency;
    this.id = params.id;
    this.lastGeneratedNumber = params.lastGeneratedNumber;
    this.nextOccurrenceDate = params.nextOccurrenceDate;
    this.occurrenceCount = params.occurrenceCount;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.projected = params.projected ?? false;
    this.skippedNumbers = params.skippedNumbers;
    this.startDate = params.startDate;
    this.status = params.status;
    this.tags = params.tags ?? [];
    this.toAccount = params.toAccount ?? null;
    this.toAccountId = params.toAccountId ?? null;
    this.type = params.type;
    this.updatedAt = params.updatedAt;
    this.value = params.value;
  }
}

export default RecurrenceEntity;
