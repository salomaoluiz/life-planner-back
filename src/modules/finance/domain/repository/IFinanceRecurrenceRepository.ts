import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { RecurrenceFrequency, RecurrenceStatus, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceRecurrenceRepository = {
  // One database transaction (spec 034 FR 20-25): patches the series and its rows from `fromNumber`, optionally
  // moving them to a new series, deleting rows after an end date or replacing them. Returns the id of the
  // series that holds the rows from `fromNumber` on (the new one when `newSeries` is set).
  applyChange(params: ApplyRecurrenceChangeRepositoryParams): Promise<string>;
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

interface ApplyRecurrenceChangeRepositoryParams {
  // Rows dated after this day are deleted; refused when one is paid / in a paid invoice.
  deleteAfter?: null | string;
  fromNumber: number;
  newSeries?: NewSeriesRepositoryParams | null;
  // Deletes the rows from `fromNumber` (refused when one is paid) and inserts these instead.
  replaceRows?: null | OccurrenceRow[];
  // Only editable rows (unpaid account rows, card rows in invoices without a payment record) take value / source changes.
  rowPatch: RowPatchRepositoryParams;
  seriesPatch: SeriesPatchRepositoryParams;
  sourceId: string;
}
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
interface NewSeriesRepositoryParams {
  accountId?: string;
  categoryId: string;
  creditCardId?: string;
  description: string;
  endDate: null | string;
  firstNumber: number;
  frequency: RecurrenceFrequency;
  lastGeneratedNumber: number;
  nextOccurrenceDate: null | string;
  owner: OwnerType;
  ownerId: string;
  skippedNumbers: number[];
  startDate: string;
  status: RecurrenceStatus;
  type: TransactionType;
  value: number;
}
interface OccurrenceRow {
  date: string;
  invoiceMonth?: string;
  number: number;
  // Account series only; omitted = not paid.
  paid?: boolean;
}
interface RowPatchRepositoryParams {
  accountId?: string;
  categoryId?: string;
  creditCardId?: string;
  description?: string;
  // New invoice month per row (a card change recomputes them).
  invoiceMonths?: { id: string; invoiceMonth: string }[];
  value?: number;
}
interface SeriesPatchRepositoryParams {
  accountId?: string;
  categoryId?: string;
  creditCardId?: string;
  description?: string;
  endDate?: null | string;
  frequency?: RecurrenceFrequency;
  lastGeneratedNumber?: number;
  nextOccurrenceDate?: null | string;
  skippedNumbers?: number[];
  status?: RecurrenceStatus;
  value?: number;
}

export {
  ApplyRecurrenceChangeRepositoryParams,
  CreateRecurrenceRepositoryParams,
  FindRecurrencesFilter,
  FutureOccurrenceNumber,
  MaterializeRecurrenceRepositoryParams,
  NewSeriesRepositoryParams,
  OccurrenceRow,
  RowPatchRepositoryParams,
  SeriesPatchRepositoryParams,
};
