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
import { QuoteContext } from '@investment/application/service/QuoteContext';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { FeeInput } from '@investment/domain/entity/OperationEntity';
import { hasOwnerAccess, OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentAssetStatus, InvestmentOperationType } from '@investment/domain/enum';
import { FractionSaleBreaksError } from '@investment/domain/error/FractionSaleBreaksError';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { NoPositionError } from '@investment/domain/error/NoPositionError';
import { IInvestmentRepository, OperationAccount } from '@investment/domain/repository';
import {
  computeFractionTotals,
  computeTotals,
  FeesHigherThanSaleError,
} from '@investment/domain/service/PositionCalculator';
import { Decimal8 } from '@shared/infra/decimal';

export const ARCHIVED_ASSET_MESSAGE = "Archived assets can't change. Reactivate it first.";
export const FX_RATE_NOT_ALLOWED_CODE = 'FX_RATE_NOT_ALLOWED';
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
  context?: QuoteContext;
  date: string;
  fees: FeeInput[];
  // Spec 108 FR 15: the event whose fraction this SELL sells.
  fractionOfOperationId?: string;
  fxRate?: null | string;
  generateTransaction: boolean;
  // Spec 108 FR 16: a fraction sale's gross is the auction amount.
  grossCents?: number;
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

// Spec 102 FR 17, spec 108 FR 13, 14, 18: what a position re-run refuses answers 422 with where it breaks.
export function toPositionException(error: unknown): unknown {
  if (error instanceof NegativePositionError) {
    return toNegativePositionException(error);
  }
  if (error instanceof NoPositionError || error instanceof FractionSaleBreaksError) {
    return new UnprocessableEntityException({
      details: { date: error.date },
      message: error.message,
    });
  }

  return error;
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
  const fxRate = draft.fxRate ?? null;

  if (fxRate !== null && asset.currency === 'BRL') {
    throw new UnprocessableEntityException({
      code: FX_RATE_NOT_ALLOWED_CODE,
      message: 'Exchange rate only applies to assets in a foreign currency',
    });
  }

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
      fractionOfOperationId: draft.fractionOfOperationId,
      fxRate,
      generateTransaction: draft.generateTransaction,
      gross: totals.gross,
      operationId: draft.operationId,
      quantity: draft.quantity,
      total: totals.total,
      type: draft.type,
      unitPrice: draft.unitPrice,
    });
  } catch (error) {
    throw toPositionException(error);
  }

  return readWriteResult(repository, asset.id, operationId, draft.context);
}

// The refreshed asset and the written operation, read back after the transaction (404 when either is gone).
export async function readWriteResult(
  repository: IInvestmentRepository,
  assetId: string,
  operationId: string,
  context?: QuoteContext,
): Promise<OperationWriteResult> {
  const detail = await repository.findAssetById(assetId);

  if (!detail) {
    throw new NotFoundException();
  }

  const operation = toAssetDetailView(detail, context).operations.find(
    (view) => view.operation.id === operationId,
  );

  if (!operation) {
    throw new NotFoundException();
  }

  return { asset: toAssetView(detailToListRow(detail), context), operation };
}

function totalsOf(draft: OperationDraft) {
  try {
    if (draft.grossCents !== undefined) {
      return computeFractionTotals(
        draft.grossCents,
        draft.fees.map((fee) => fee.amount),
      );
    }

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
