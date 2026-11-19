import { UnprocessableEntityException } from '@nestjs/common';

import {
  CalendarDateSchema,
  DescriptionSchema,
  INT4_MAX,
  INT4_MIN,
  TagNameSchema,
} from '@finance/application/dto/FinanceCommon';
import { ImportRow } from '@finance/application/dto/ImportTransactions';
import {
  ImportRowError,
  mapConsistencyError,
  normalizeTags,
} from '@finance/application/service/ImportRows';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { hasOwnerAccess, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { AccountStatus, SystemCategoryKey } from '@finance/domain/enum';
import { CurrencyCode, SUPPORTED_CURRENCIES } from '@finance/domain/enum/Currency';
import {
  IFinanceAccountRepository,
  IFinanceCreditCardRepository,
  WriteSplitRepositoryParams,
} from '@finance/domain/repository';
import { parseInvoiceMonth } from '@finance/domain/service/ImportRowKind';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { normalizeNotes, NOTES_MAX } from '@finance/domain/service/Notes';
import {
  assertParts,
  SPLIT_MAX_PARTS,
  SPLIT_MIN_PARTS,
  SplitRuleError,
} from '@finance/domain/service/SplitRules';
interface CheckSplitRowsParams {
  accessibleOwners: OwnerAccess[];
  accountRepository: IFinanceAccountRepository;
  creditCardRepository: IFinanceCreditCardRepository;
  ensureConsistencyUseCase: EnsureTransactionConsistencyUseCase;
  requesterId: string;
  rows: ImportRow[];
  today: string;
}

// Spec 119 FR 38: the lines with the same `splitGroup` become ONE split (all or nothing for the file: the caller writes
// none of them when `errors` is not empty). The first line gives the description and the notes.
interface ResolvedSource extends OwnerAccess {
  closingDay?: number;
  currency: CurrencyCode;
}

export async function checkSplitRows(
  params: CheckSplitRowsParams,
): Promise<{ errors: ImportRowError[]; splits: WriteSplitRepositoryParams[] }> {
  const errors: ImportRowError[] = [];
  const splits: WriteSplitRepositoryParams[] = [];
  const groups = new Map<string, ImportRow[]>();

  for (const row of params.rows) {
    groups.set(row.splitGroup as string, [...(groups.get(row.splitGroup as string) ?? []), row]);
  }

  for (const rows of groups.values()) {
    const checked = await checkGroup(rows, params);

    if (Array.isArray(checked)) {
      errors.push(...checked);
    } else {
      splits.push(checked);
    }
  }

  return { errors, splits };
}
export function isSplitRow(row: ImportRow): boolean {
  return !!row.splitGroup;
}

async function checkGroup(
  rows: ImportRow[],
  params: CheckSplitRowsParams,
): Promise<ImportRowError[] | WriteSplitRepositoryParams> {
  if (rows.length < SPLIT_MIN_PARTS || rows.length > SPLIT_MAX_PARTS) {
    return everyLine(rows, 'SPLIT_GROUP_SIZE', 'A split has 2 to 50 lines');
  }

  const [first] = rows;
  const adjustmentId = SYSTEM_CATEGORY_IDS[SystemCategoryKey.SPLIT_ADJUSTMENT];
  const rowErrors = rows
    .map((row) => shapeError(row, row.categoryId === adjustmentId))
    .filter((error): error is ImportRowError => error !== undefined);

  if (rowErrors.length > 0) {
    return rowErrors;
  }
  if (
    rows.some(
      (row) =>
        row.date !== first.date ||
        (row.accountId ?? null) !== (first.accountId ?? null) ||
        (row.creditCardId ?? null) !== (first.creditCardId ?? null) ||
        (row.currency ?? null) !== (first.currency ?? null) ||
        (row.paid ?? null) !== (first.paid ?? null),
    )
  ) {
    return everyLine(
      rows,
      'SPLIT_GROUP_MISMATCH',
      'The lines of a split must share date, account or card, currency and paid',
    );
  }
  if (!first.accountId === !first.creditCardId) {
    return everyLine(rows, 'ACCOUNT_NOT_FOUND', 'Choose an account or a card');
  }
  if ((first.notes ?? '').trim().length > NOTES_MAX) {
    return [{ code: 'NOTES_TOO_LONG', line: first.line, message: 'Notes are too long' }];
  }

  const source = await resolveSource(first, params);

  if ('code' in source) {
    return everyLine(rows, source.code, source.message);
  }

  const parts = rows.map((row) => ({
    categoryId: row.categoryId,
    type: row.type,
    value: row.value,
  }));

  try {
    assertParts(parts, { card: !!first.creditCardId });
  } catch (error) {
    if (error instanceof SplitRuleError) {
      return everyLine(rows, 'SPLIT_GROUP_INVALID', error.code);
    }
    throw error;
  }

  for (const row of rows) {
    try {
      await params.ensureConsistencyUseCase.execute({
        accessibleOwners: params.accessibleOwners,
        accountId: row.accountId ?? undefined,
        allowSplitAdjustment: true,
        blockArchivedCategory: true,
        categoryId: row.categoryId,
        creditCardId: row.creditCardId ?? undefined,
        currency: (row.currency ?? undefined) as CurrencyCode | undefined,
        owner: source.owner,
        ownerId: source.ownerId,
        type: row.type,
      });
    } catch (error) {
      const mapped = mapConsistencyError(error, row.line);

      if (mapped) {
        return [mapped];
      }
      if (error instanceof UnprocessableEntityException) {
        return [{ code: 'SYSTEM_CATEGORY', line: row.line, message: error.message }];
      }

      throw error;
    }
  }

  return {
    accountId: first.accountId ?? null,
    createdBy: params.requesterId,
    creditCardId: first.creditCardId ?? null,
    currency: source.currency,
    date: first.date,
    description: first.description.trim(),
    invoiceMonth: source.closingDay
      ? ((parseInvoiceMonth(first.invoiceMonth) as null | string) ??
        invoiceMonthOf(first.date, source.closingDay))
      : null,
    notes: normalizeNotes(first.notes ?? null),
    owner: source.owner,
    ownerId: source.ownerId,
    paid: first.accountId ? (first.paid ?? first.date <= params.today) : null,
    parts: rows.map((row) => ({
      categoryId: row.categoryId,
      description:
        row.description.trim() === first.description.trim() ? null : row.description.trim(),
      tags: normalizeTags(row.tags),
      type: row.type,
      value: row.value,
    })),
  };
}
function everyLine(rows: ImportRow[], code: ImportRowError['code'], message: string) {
  return rows.map((row) => ({ code, line: row.line, message }));
}
async function resolveSource(
  first: ImportRow,
  params: CheckSplitRowsParams,
): Promise<ImportRowError | ResolvedSource> {
  const base = { line: first.line };

  if (first.accountId) {
    const account = await params.accountRepository.findAccountById(first.accountId);

    if (!account) {
      return { ...base, code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' };
    }
    if (!hasOwnerAccess(params.accessibleOwners, account)) {
      return { ...base, code: 'OWNER_NOT_ACCESSIBLE', message: 'Owner not accessible' };
    }
    if (
      params.accessibleOwners.find(
        (item) => item.owner === account.owner && item.ownerId === account.ownerId,
      )?.archived
    ) {
      return { ...base, code: 'OWNER_ARCHIVED', message: 'Family is archived' };
    }
    if (account.status === AccountStatus.ARCHIVED) {
      return { ...base, code: 'ACCOUNT_ARCHIVED', message: 'Account is archived' };
    }
    if (first.currency && first.currency !== account.currency) {
      return {
        ...base,
        code: 'CURRENCY_MISMATCH',
        message: 'Transaction currency must match the account currency',
      };
    }

    return { currency: account.currency, owner: account.owner, ownerId: account.ownerId };
  }

  const card = await params.creditCardRepository.findCreditCardById(first.creditCardId as string);

  if (!card || !hasOwnerAccess(params.accessibleOwners, card)) {
    return { ...base, code: 'CARD_NOT_FOUND', message: 'Credit card not found' };
  }
  try {
    ensureOwnerWritable(params.accessibleOwners, card);
  } catch {
    return { ...base, code: 'OWNER_ARCHIVED', message: 'Family is archived' };
  }
  if (card.status === AccountStatus.ARCHIVED) {
    return { ...base, code: 'ACCOUNT_ARCHIVED', message: 'Credit card is archived' };
  }
  if (first.currency && first.currency !== card.currency) {
    return {
      ...base,
      code: 'CURRENCY_MISMATCH',
      message: 'Transaction currency must match the credit card currency',
    };
  }

  return {
    closingDay: card.closingDay,
    currency: card.currency,
    owner: card.owner,
    ownerId: card.ownerId,
  };
}
function shapeError(row: ImportRow, isAdjustment: boolean): ImportRowError | undefined {
  const { line } = row;

  if (!CalendarDateSchema.safeParse(row.date).success) {
    return { code: 'INVALID_DATE', line, message: 'Invalid date' };
  }
  // A part is above zero; only the adjustment may be negative (FR 11); either way within int4.
  if (
    !Number.isInteger(row.value) ||
    row.value === 0 ||
    (row.value < 0 && !isAdjustment) ||
    row.value > INT4_MAX ||
    row.value < INT4_MIN
  ) {
    return { code: 'INVALID_VALUE', line, message: 'Invalid amount' };
  }
  if (!DescriptionSchema.safeParse(row.description).success) {
    return { code: 'DESCRIPTION_INVALID', line, message: 'Invalid description' };
  }
  if (normalizeTags(row.tags).some((tag) => !TagNameSchema.safeParse(tag).success)) {
    return { code: 'TAG_TOO_LONG', line, message: 'A tag has at most 30 characters' };
  }
  if (row.currency && !(SUPPORTED_CURRENCIES as readonly string[]).includes(row.currency)) {
    return { code: 'UNSUPPORTED_CURRENCY', line, message: 'Currency not supported' };
  }

  return undefined;
}
