import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { RecurrenceFrequency, RecurrenceStatus, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceRecurrenceRepository = {
  // One database transaction: the series, its real rows and the ledger of the paid ones. Returns the series id.
  create(params: CreateRecurrenceRepositoryParams): Promise<string>;
  findById(id: string): Promise<RecurrenceEntity | undefined>;
  // ACTIVE series whose `nextOccurrenceDate` is on or before `horizon`.
  findDue(owners: OwnerAccess[], horizon: string): Promise<RecurrenceEntity[]>;
  // Real rows of these series dated after `afterDate` (they hide the matching projected occurrences).
  findFutureNumbers(recurrenceIds: string[], afterDate: string): Promise<FutureOccurrenceNumber[]>;
  // Real rows of the series ordered by occurrence number.
  findByOwners(owners: OwnerAccess[], filter?: FindRecurrencesFilter): Promise<RecurrenceEntity[]>;
  findOccurrences(recurrenceId: string): Promise<TransactionEntity[]>;
  // Idempotent: does nothing when the stored `lastGeneratedNumber` is no longer `expectedLast`.
  materialize(params: MaterializeRecurrenceRepositoryParams): Promise<void>;
};

interface CreateRecurrenceRepositoryParams {
  accountId?: string;
  categoryId: string;
  creditCardId?: string;
  description: string;
  endDate?: null | string;
  frequency: RecurrenceFrequency;
  lastGeneratedNumber: number;
  nextOccurrenceDate: null | string;
  owner: OwnerType;
  ownerId: string;
  rows: OccurrenceRow[];
  startDate: string;
  status: RecurrenceStatus;
  type: TransactionType;
  value: number;
}
interface FindRecurrencesFilter {
  accountId?: string;
  creditCardId?: string;
  status?: RecurrenceStatus;
}
interface FutureOccurrenceNumber {
  occurrenceNumber: number;
  recurrenceId: string;
}
interface MaterializeRecurrenceRepositoryParams {
  expectedLast: number;
  id: string;
  lastGeneratedNumber: number;
  nextOccurrenceDate: null | string;
  rows: OccurrenceRow[];
  status: RecurrenceStatus;
}
// One real occurrence to insert: `number` is the displayed occurrence number.
interface OccurrenceRow {
  date: string;
  invoiceMonth?: string;
  number: number;
  // Account series only; omitted = not paid.
  paid?: boolean;
}

export {
  CreateRecurrenceRepositoryParams,
  FindRecurrencesFilter,
  FutureOccurrenceNumber,
  MaterializeRecurrenceRepositoryParams,
  OccurrenceRow,
};
