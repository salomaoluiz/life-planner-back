import { ImportRowError } from '@finance/application/service/ImportRows';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { hasOwnerAccess, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import {
  IFinanceAccountRepository,
  TransferSide,
  WriteTransferRepositoryParams,
} from '@finance/domain/repository';
import { normalizeNotes } from '@finance/domain/service/Notes';
import {
  groupTransferRows,
  TransferImportGroup,
  TransferImportRow,
} from '@finance/domain/service/TransferImport';

interface CheckTransferRowsParams {
  accessibleOwners: OwnerAccess[];
  accountRepository: IFinanceAccountRepository;
  requesterId: string;
  rows: TransferImportRow[];
  today: string;
}

// Spec 098 FR 12: the rows of the transfer categories become whole transfers (all or nothing for the file: the caller
// writes none of them when `errors` is not empty).
export async function checkTransferRows(
  params: CheckTransferRowsParams,
): Promise<{ errors: ImportRowError[]; transfers: WriteTransferRepositoryParams[] }> {
  if (params.rows.length === 0) {
    return { errors: [], transfers: [] };
  }

  const { errors: groupErrors, groups } = groupTransferRows(params.rows);
  const errors: ImportRowError[] = [...groupErrors];
  const ids = [
    ...new Set(groups.flatMap((group) => [group.out.accountId, group.in.accountId])),
  ].filter((id): id is string => typeof id === 'string');
  const accounts = ids.length > 0 ? await params.accountRepository.findAccountsByIds(ids) : [];
  const transfers: WriteTransferRepositoryParams[] = [];

  for (const group of groups) {
    const sides = resolveSides(group, accounts, params.accessibleOwners);

    if ('code' in sides) {
      errors.push(sides);
      continue;
    }

    transfers.push({
      amountIn: group.in.value,
      amountOut: group.out.value,
      createdBy: params.requesterId,
      dateIn: group.in.date,
      dateOut: group.out.date,
      description: group.out.description,
      fee: group.fee ?? null,
      notes: normalizeNotes(group.out.notes),
      paid: group.paid ?? group.out.date <= params.today,
      ...sides,
    });
  }

  return { errors, transfers };
}

function resolveSides(
  group: TransferImportGroup,
  accounts: AccountEntity[],
  accessibleOwners: OwnerAccess[],
): { from: TransferSide; to: TransferSide } | ImportRowError {
  const checks: [TransferImportRow, AccountEntity | undefined][] = [
    [group.out, accounts.find((account) => account.id === group.out.accountId)],
    [group.in, accounts.find((account) => account.id === group.in.accountId)],
  ];

  for (const [row, account] of checks) {
    const line = row.line;

    if (!account) {
      return { code: 'ACCOUNT_NOT_FOUND', line, message: 'Account not found' };
    }
    if (!hasOwnerAccess(accessibleOwners, account)) {
      return { code: 'OWNER_NOT_ACCESSIBLE', line, message: 'Owner not accessible' };
    }
    if (
      accessibleOwners.find(
        (item) => item.owner === account.owner && item.ownerId === account.ownerId,
      )?.archived
    ) {
      return { code: 'OWNER_ARCHIVED', line, message: 'Family is archived' };
    }
    if (account.status === AccountStatus.ARCHIVED) {
      return { code: 'ACCOUNT_ARCHIVED', line, message: 'Account is archived' };
    }
    if (row.currency && row.currency !== account.currency) {
      return {
        code: 'CURRENCY_MISMATCH',
        line,
        message: 'Transaction currency must match the account currency',
      };
    }
  }

  return { from: side(checks[0][1] as AccountEntity), to: side(checks[1][1] as AccountEntity) };
}
function side(account: AccountEntity): TransferSide {
  return {
    accountId: account.id,
    currency: account.currency,
    owner: account.owner,
    ownerId: account.ownerId,
  };
}
