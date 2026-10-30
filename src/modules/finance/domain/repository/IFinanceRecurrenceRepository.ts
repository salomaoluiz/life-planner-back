import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { RecurrenceFrequency, RecurrenceStatus, TransactionType } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceRecurrenceRepository = {
  // One database transaction (spec 034 FR 20-25): patches the series and its rows from `fromNumber`, optionally
  // moving them to a new series, deleting rows after an end date or replacing them. Returns the id of the
  // series that holds the rows from `fromNumber` on (the new one when `newSeries` is set).
  applyChange(params: ApplyRecurrenceChangeRepositoryParams): Promise<string>;
  // One database transaction: the series, its real rows and the ledger of the paid ones. Returns the series id.
  create(params: CreateRecurrenceRepositoryParams): Promise<string>;
  // Creates the real row of a projected occurrence, with the edits of the caller (spec 034 FR 21).
  // Series (any status) of an account OR a card: they block deleting it (FK RESTRICT, spec 034 FR 35).
  countBySource(source: { accountId?: string; creditCardId?: string }): Promise<number>;
  createOccurrence(params: CreateOccurrenceRepositoryParams): Promise<TransactionEntity>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findById(id: string): Promise<RecurrenceEntity | undefined>;
  // ACTIVE series whose `nextOccurrenceDate` is on or before `horizon`.
  findDue(owners: OwnerAccess[], horizon: string): Promise<RecurrenceEntity[]>;
  // Numbers above `afterNumber` that already have a real row (they hide the matching projected occurrences).
  findFutureNumbers(
    series: { afterNumber: number; recurrenceId: string }[],
  ): Promise<FutureOccurrenceNumber[]>;
  // Real rows of the series ordered by occurrence number.
  findByOwners(owners: OwnerAccess[], filter?: FindRecurrencesFilter): Promise<RecurrenceEntity[]>;
  findOccurrences(recurrenceId: string): Promise<TransactionEntity[]>;
  // Idempotent: does nothing when the stored `lastGeneratedNumber` is no longer `expectedLast`.
  materialize(params: MaterializeRecurrenceRepositoryParams): Promise<void>;
  // One database transaction (spec 034 FR 29-31): deletes the real rows from `fromNumber` (reversing the ledger of
  // the paid ones) and then deletes the series or patches it. Without `confirmPaid` paid account rows answer 409.
  removeFrom(params: RemoveRecurrenceRepositoryParams): Promise<RemoveRecurrenceResult>;
  // A projected occurrence deleted alone: it is never materialized nor projected again.
  skipNumber(id: string, occurrenceNumber: number): Promise<void>;
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
  // See the datasource: `undefined` keeps the tags, a list replaces them on the target series and its rows.
  tags?: string[];
}
interface CreateOccurrenceRepositoryParams {
  categoryId?: string;
  date: string;
  description?: string;
  invoiceMonth?: string;
  notes?: null | string;
  number: number;
  paid?: boolean;
  recurrenceId: string;
  tags?: string[];
  value?: number;
}
interface CreateRecurrenceRepositoryParams {
  accountId?: string;
  categoryId: string;
  creditCardId?: string;
  currency: CurrencyCode;
  description: string;
  endDate?: null | string;
  frequency: RecurrenceFrequency;
  lastGeneratedNumber: number;
  nextOccurrenceDate: null | string;
  notes?: null | string;
  owner: OwnerType;
  ownerId: string;
  rows: OccurrenceRow[];
  startDate: string;
  status: RecurrenceStatus;
  tags?: string[];
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
  currency: CurrencyCode;
  description: string;
  endDate: null | string;
  firstNumber: number;
  frequency: RecurrenceFrequency;
  lastGeneratedNumber: number;
  nextOccurrenceDate: null | string;
  notes?: null | string;
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
interface RemoveRecurrenceRepositoryParams {
  confirmPaid: boolean;
  deleteSeries: boolean;
  // true (scope ALL): card rows in a paid invoice and refunded rows stay, detached from the series.
  // false (THIS_AND_NEXT): they refuse the delete with 422.
  detachLocked: boolean;
  fromNumber: number;
  id: string;
  seriesPatch?: SeriesPatchRepositoryParams;
}
interface RemoveRecurrenceResult {
  deleted: number;
  detached: number;
}
interface RowPatchRepositoryParams {
  accountId?: string;
  categoryId?: string;
  creditCardId?: string;
  description?: string;
  notes?: null | string;
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
  notes?: null | string;
  skippedNumbers?: number[];
  status?: RecurrenceStatus;
  value?: number;
}

export {
  ApplyRecurrenceChangeRepositoryParams,
  CreateOccurrenceRepositoryParams,
  CreateRecurrenceRepositoryParams,
  FindRecurrencesFilter,
  FutureOccurrenceNumber,
  MaterializeRecurrenceRepositoryParams,
  NewSeriesRepositoryParams,
  OccurrenceRow,
  RemoveRecurrenceRepositoryParams,
  RemoveRecurrenceResult,
  RowPatchRepositoryParams,
  SeriesPatchRepositoryParams,
};
