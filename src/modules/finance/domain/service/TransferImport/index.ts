import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey } from '@finance/domain/enum';

export interface TransferImportError {
  code: TransferImportErrorCode;
  line: number;
  message: string;
}
export type TransferImportErrorCode =
  | 'TRANSFER_AMOUNT_MISMATCH'
  | 'TRANSFER_DATE_IN_BEFORE_OUT'
  | 'TRANSFER_INCOMPLETE'
  | 'TRANSFER_SAME_ACCOUNT';
export interface TransferImportGroup {
  fee?: number;
  in: TransferImportRow;
  // The line of the out row: where the transfer is reported.
  line: number;
  out: TransferImportRow;
  paid: boolean | null;
}
export interface TransferImportRow {
  accountId?: null | string;
  categoryId: string;
  currency?: null | string;
  date: string;
  description: string;
  line: number;
  notes?: null | string;
  paid?: boolean | null;
  transferId?: null | string;
  value: number;
}
export type TransferRowKind = 'FEE' | 'IN' | 'OUT';

const KINDS: [SystemCategoryKey, TransferRowKind][] = [
  [SystemCategoryKey.TRANSFER_OUT, 'OUT'],
  [SystemCategoryKey.TRANSFER_IN, 'IN'],
  [SystemCategoryKey.TRANSFER_FEE, 'FEE'],
];

// Spec 098 FR 12: which side of a transfer a row is, from its (system) category; `undefined` for any other row.
export function transferRowKind(categoryId: string): TransferRowKind | undefined {
  return KINDS.find(([key]) => SYSTEM_CATEGORY_IDS[key] === categoryId)?.[1];
}

// Rows of those categories are grouped by `Transfer ID`: exactly one out, one in and at most one fee (on the in account);
// different accounts, the in date not before the out date, equal amounts when both sides have the same currency.
export function groupTransferRows(rows: TransferImportRow[]): {
  errors: TransferImportError[];
  groups: TransferImportGroup[];
} {
  const errors: TransferImportError[] = [];
  const groups: TransferImportGroup[] = [];
  const byId = new Map<string, TransferImportRow[]>();

  for (const row of rows) {
    if (!row.transferId) {
      errors.push(incomplete(row.line, 'A transfer row needs its Transfer ID'));
      continue;
    }
    byId.set(row.transferId, [...(byId.get(row.transferId) ?? []), row]);
  }

  for (const members of byId.values()) {
    const found = checkGroup(members);

    if ('code' in found) {
      errors.push(found);
    } else {
      groups.push(found);
    }
  }

  return { errors, groups };
}

function checkGroup(members: TransferImportRow[]): TransferImportError | TransferImportGroup {
  const first = members[0].line;
  const outs = members.filter((row) => transferRowKind(row.categoryId) === 'OUT');
  const ins = members.filter((row) => transferRowKind(row.categoryId) === 'IN');
  const fees = members.filter((row) => transferRowKind(row.categoryId) === 'FEE');

  if (outs.length !== 1 || ins.length !== 1 || fees.length > 1) {
    return incomplete(first, 'A transfer needs one out row, one in row and at most one fee row');
  }
  const [out] = outs;
  const [incoming] = ins;

  if (fees.length === 1 && fees[0].accountId !== incoming.accountId) {
    return incomplete(fees[0].line, 'The fee is charged on the destination account');
  }
  if (out.accountId === incoming.accountId) {
    return {
      code: 'TRANSFER_SAME_ACCOUNT',
      line: incoming.line,
      message: 'Origin and destination are the same account',
    };
  }
  if (out.currency === incoming.currency && out.value !== incoming.value) {
    return {
      code: 'TRANSFER_AMOUNT_MISMATCH',
      line: incoming.line,
      message: 'Same-currency transfers need equal amounts',
    };
  }
  if (incoming.date < out.date) {
    return {
      code: 'TRANSFER_DATE_IN_BEFORE_OUT',
      line: incoming.line,
      message: 'The in date is before the out date',
    };
  }

  return {
    fee: fees[0]?.value,
    in: incoming,
    line: out.line,
    out,
    paid: out.paid ?? null,
  };
}
function incomplete(line: number, message: string): TransferImportError {
  return { code: 'TRANSFER_INCOMPLETE', line, message };
}
