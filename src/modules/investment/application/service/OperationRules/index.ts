import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  AssetView,
  detailToListRow,
  OperationView,
  toAssetDetailView,
  toAssetView,
} from '@investment/application/service/AssetView';
import { ensureOwnerWritable } from '@investment/application/service/OwnerWritable';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { FeeInput } from '@investment/domain/entity/OperationEntity';
import { hasOwnerAccess, OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentAssetStatus, InvestmentOperationType } from '@investment/domain/enum';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { IInvestmentRepository, OperationAccount } from '@investment/domain/repository';
import {
  computeTotals,
  FeesHigherThanSaleError,
} from '@investment/domain/service/PositionCalculator';
import { Decimal8 } from '@shared/infra/decimal';

export const ARCHIVED_ASSET_MESSAGE = "Archived assets can't change. Reactivate it first.";
export const ACCOUNT_NOT_CHANGEABLE_MESSAGE = "This operation uses an account you can't change";

// 404 for an asset the caller cannot reach, 422 for an archived family or an archived asset (FR 7).
export async function loadWritableAsset(
  repository: IInvestmentRepository,
  assetId: string,
  owners: OwnerAccess[],
): Promise<AssetDetail> {
  const asset = await repository.findAssetById(assetId);

  if (!asset || !hasOwnerAccess(owners, asset)) {
    throw new NotFoundException();
  }

  ensureOwnerWritable(owners, asset);

  if (asset.status === InvestmentAssetStatus.ARCHIVED) {
    throw new UnprocessableEntityException(ARCHIVED_ASSET_MESSAGE);
  }

  return asset;
}

// FR 3 of section 4: an operation that points to an account the caller cannot write is read-only for them.
export async function assertLinkedAccountChangeable(
  repository: IInvestmentRepository,
  owners: OwnerAccess[],
  accountId: null | string,
): Promise<void> {
  if (!accountId) {
    return;
  }

  const account = await repository.findAccountForOperation(accountId);

  if (account && !canWrite(owners, account)) {
    throw new ForbiddenException(ACCOUNT_NOT_CHANGEABLE_MESSAGE);
  }
}

// The account that pays an operation: reachable and writable by the caller, ACTIVE, in the asset currency.
export async function resolveOperationAccount(
  repository: IInvestmentRepository,
  owners: OwnerAccess[],
  accountId: string,
  currency: string,
): Promise<OperationAccount> {
  const account = await repository.findAccountForOperation(accountId);

  if (!account) {
    throw new NotFoundException('Account not found');
  }

  if (!hasOwnerAccess(owners, account)) {
    throw new ForbiddenException('Account not accessible');
  }

  ensureOwnerWritable(owners, account);

  if (account.archived) {
    throw new UnprocessableEntityException('Account is archived');
  }
  if (account.currency !== currency) {
    throw new UnprocessableEntityException('Account currency differs from the asset currency');
  }

  return account;
}

// FR 17: the never-negative rule answers 422 with where it breaks.
export interface OperationDraft {
  accountId: null | string;
  asset: AssetDetail;
  date: string;
  fees: FeeInput[];
  generateTransaction: boolean;
  operationId?: string;
  owners: OwnerAccess[];
  quantity: Decimal8;
  type: InvestmentOperationType;
  unitPrice: Decimal8;
}
export interface OperationWriteResult {
  asset: AssetView;
  operation: OperationView;
}

export function toNegativePositionException(
  error: NegativePositionError,
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    details: { date: error.date, operationId: error.operationId },
    message: error.message,
  });
}

function canWrite(owners: OwnerAccess[], account: OperationAccount): boolean {
  return (
    hasOwnerAccess(owners, account) &&
    !owners.find((access) => access.owner === account.owner && access.ownerId === account.ownerId)
      ?.archived
  );
}

// Totals (FR 14), the paying account (FR 10, 19), the one-transaction write and the refreshed view.
export async function persistOperation(
  repository: IInvestmentRepository,
  draft: OperationDraft,
): Promise<OperationWriteResult> {
  const { asset } = draft;
  const totals = totalsOf(draft);

  if (draft.generateTransaction && draft.accountId) {
    await resolveOperationAccount(repository, draft.owners, draft.accountId, asset.currency);
  }

  let operationId: string;

  try {
    operationId = await repository.writeOperation({
      accountId: draft.generateTransaction ? draft.accountId : null,
      assetId: asset.id,
      assetLabel: asset.ticker ?? asset.name,
      currency: asset.currency,
      date: draft.date,
      fees: draft.fees,
      feesTotal: totals.feesTotal,
      generateTransaction: draft.generateTransaction,
      gross: totals.gross,
      operationId: draft.operationId,
      quantity: draft.quantity,
      total: totals.total,
      type: draft.type,
      unitPrice: draft.unitPrice,
    });
  } catch (error) {
    throw error instanceof NegativePositionError ? toNegativePositionException(error) : error;
  }

  const detail = await repository.findAssetById(asset.id);

  if (!detail) {
    throw new NotFoundException();
  }

  const operation = toAssetDetailView(detail).operations.find(
    (view) => view.operation.id === operationId,
  );

  if (!operation) {
    throw new NotFoundException();
  }

  return { asset: toAssetView(detailToListRow(detail)), operation };
}

function totalsOf(draft: OperationDraft) {
  try {
    return computeTotals(
      draft.type,
      draft.quantity,
      draft.unitPrice,
      draft.fees.map((fee) => fee.amount),
    );
  } catch (error) {
    throw error instanceof FeesHigherThanSaleError
      ? new UnprocessableEntityException(error.message)
      : error;
  }
}
