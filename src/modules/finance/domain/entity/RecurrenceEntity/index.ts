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
  occurrenceCount: null | number;
  owner: OwnerType;
  ownerId: string;
  skippedNumbers: number[];
  startDate: string;
  status: RecurrenceStatus;
  tags?: TagRef[];
  type: TransactionType;
  updatedAt: Date;
  value: number;
}

// A recurring series (spec 034): the template of its transactions plus the schedule. Real rows are
// `TransactionEntity` with `recurrenceId`; later occurrences are projected by `RecurrenceSchedule`.
class RecurrenceEntity {
  account: null | TransactionAccountSummary;
  accountId: null | string;
  category: TransactionCategorySummary;
  categoryId: string;
  createdAt: Date;
  creditCard: null | TransactionCardSummary;
  creditCardId: null | string;
  currency: CurrencyCode;
  description: string;
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
  // Occurrence NUMBERS (as displayed) of projected occurrences deleted alone.
  skippedNumbers: number[];
  startDate: string;
  status: RecurrenceStatus;
  // Spec 043: the tags the occurrences of the series get, in the stored order.
  tags: TagRef[];
  type: TransactionType;
  updatedAt: Date;
  // Integer cents, always > 0.
  value: number;

  constructor(params: IRecurrenceEntity) {
    this.account = params.account;
    this.accountId = params.accountId;
    this.category = params.category;
    this.categoryId = params.categoryId;
    this.createdAt = params.createdAt;
    this.creditCard = params.creditCard;
    this.creditCardId = params.creditCardId;
    this.currency = params.currency ?? DEFAULT_CURRENCY;
    this.description = params.description;
    this.endDate = params.endDate;
    this.firstNumber = params.firstNumber;
    this.frequency = params.frequency;
    this.id = params.id;
    this.lastGeneratedNumber = params.lastGeneratedNumber;
    this.nextOccurrenceDate = params.nextOccurrenceDate;
    this.occurrenceCount = params.occurrenceCount;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.skippedNumbers = params.skippedNumbers;
    this.startDate = params.startDate;
    this.status = params.status;
    this.tags = params.tags ?? [];
    this.type = params.type;
    this.updatedAt = params.updatedAt;
    this.value = params.value;
  }
}

export default RecurrenceEntity;
