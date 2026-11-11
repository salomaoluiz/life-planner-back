import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { IncomeStatus } from '@investment/application/dto/Income';
import { ensureOwnerWritable } from '@investment/application/service/OwnerWritable';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { IncomeCategory, IncomeEntity } from '@investment/domain/entity/IncomeEntity';
import { hasOwnerAccess, OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentIncomeType, InvestmentOperationType } from '@investment/domain/enum';
import {
  IIncomeRepository,
  IInvestmentRepository,
  OperationAccount,
} from '@investment/domain/repository';
import {
  bpsToRate,
  defaultIncomeType,
  estimateIncome,
  withholdingBps,
} from '@investment/domain/service/IncomeWithholding';
import { calculatePosition } from '@investment/domain/service/PositionCalculator';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

export const NOTES_MAX_LENGTH = 1000;
export const ACCOUNT_NOT_CHANGEABLE_MESSAGE = "This income uses an account you can't change";

export interface IncomeDefaults {
  accountId: null | string;
  categoryId: null | string;
  currency: string;
  quantity: string;
  type: InvestmentIncomeType;
  withholdingRate: string;
}
export interface IncomeDraft {
  accountId: string;
  amountPerUnit: Decimal8 | null;
  categoryId: string;
  createdBy: string;
  exDate: null | string;
  incomeId?: string;
  netAmount: number;
  notes?: null | string;
  paymentDate: string;
  quantity: Decimal8 | null;
  status: IncomeStatus;
  suggestionId?: null | string;
  type: InvestmentIncomeType;
}
export interface IncomeView {
  estimatedGross: number;
  estimatedWithheld: number;
  income: IncomeEntity;
  overdue: boolean;
  status: IncomeStatus;
  withholdingRate: string;
}

export function codeError(code: string, message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message });
}

// 404 for an asset the caller cannot reach (read).
export async function loadReadableAsset(
  repository: IInvestmentRepository,
  assetId: string,
  owners: OwnerAccess[],
): Promise<AssetDetail> {
  const asset = await repository.findAssetById(assetId);

  if (!asset || !hasOwnerAccess(owners, asset)) {
    throw new NotFoundException();
  }

  return asset;
}

// The income and its asset, 404 when either cannot be reached.
export async function loadIncome(
  incomes: IIncomeRepository,
  investment: IInvestmentRepository,
  id: string,
  owners: OwnerAccess[],
): Promise<{ asset: AssetDetail; income: IncomeEntity }> {
  const income = await incomes.findIncomeById(id);

  if (!income) {
    throw new NotFoundException();
  }

  return { asset: await loadReadableAsset(investment, income.assetId, owners), income };
}

// The caller must be able to write the account of an existing row (spec 107 section 4).
export async function assertIncomeAccountChangeable(
  investment: IInvestmentRepository,
  owners: OwnerAccess[],
  accountId: null | string,
): Promise<void> {
  if (!accountId) {
    return;
  }

  const account = await investment.findAccountForOperation(accountId);

  if (account && !hasOwnerAccess(owners, account)) {
    throw new ForbiddenException(ACCOUNT_NOT_CHANGEABLE_MESSAGE);
  }
  if (account) {
    ensureOwnerWritable(owners, account);
  }
}

// FR 3: reachable and writable by the caller, active and in the asset currency.
export async function resolveIncomeAccount(
  investment: IInvestmentRepository,
  owners: OwnerAccess[],
  accountId: string,
  currency: string,
): Promise<OperationAccount> {
  const account = await investment.findAccountForOperation(accountId);

  if (!account || !hasOwnerAccess(owners, account)) {
    throw new NotFoundException('Account not found');
  }

  ensureOwnerWritable(owners, account);

  if (account.archived) {
    throw codeError('ACCOUNT_ARCHIVED', 'Account is archived');
  }
  if (account.currency !== currency) {
    throw codeError('CURRENCY_MISMATCH', 'Account currency differs from the asset currency');
  }

  return account;
}

// The stored income as an editable draft; an income whose finance row lost its account or category cannot be saved
// until the owner picks them (422 `INCOME_INCOMPLETE`).
export function draftFromIncome(
  income: IncomeEntity,
  userId: string,
  pick: { accountId?: string; categoryId?: string } = {},
): IncomeDraft {
  const accountId = pick.accountId ?? income.accountId;
  const categoryId = pick.categoryId ?? income.categoryId;

  if (!accountId || !categoryId) {
    throw incompleteError([
      ...(accountId ? [] : ['accountId']),
      ...(categoryId ? [] : ['categoryId']),
    ]);
  }

  return {
    accountId,
    amountPerUnit: income.amountPerUnit ? Decimal8.parse(income.amountPerUnit) : null,
    categoryId,
    createdBy: userId,
    exDate: income.exDate,
    incomeId: income.id,
    netAmount: income.netAmount,
    notes: income.notes,
    paymentDate: income.paymentDate,
    quantity: income.quantity ? Decimal8.parse(income.quantity) : null,
    status: income.paid ? 'RECEIVED' : 'PLANNED',
    suggestionId: income.suggestionId,
    type: income.type,
  };
}
export function incompleteError(missing: string[]): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INCOME_INCOMPLETE',
    message: 'Fill the missing fields to save the income',
    missing,
  });
}
export function isCategoryUsable(
  category: IncomeCategory,
  target: { owner: OwnerType; ownerId: string },
): boolean {
  if (category.owner === target.owner && category.ownerId === target.ownerId) {
    return true;
  }

  return (
    category.allScopes &&
    category.scopes.some(
      (scope) => scope.owner === target.owner && scope.ownerId === target.ownerId,
    )
  );
}

// FR 8: an active INCOME category usable by the account owner.
export function normalizeIncomeNotes(notes: null | string | undefined): null | string {
  const text = notes?.trim() ?? '';

  if (text.length > NOTES_MAX_LENGTH) {
    throw codeError('NOTES_TOO_LONG', `Notes must have at most ${NOTES_MAX_LENGTH} characters`);
  }

  return text === '' ? null : text;
}
export async function resolveIncomeCategory(
  incomes: IIncomeRepository,
  target: { owner: OwnerType; ownerId: string },
  categoryId: string,
): Promise<IncomeCategory> {
  const category = await incomes.findCategoryById(categoryId);

  if (!category || (!category.isSystem && !isCategoryUsable(category, target))) {
    throw new NotFoundException('Category not found');
  }
  if (category.isSystem || !category.isIncome) {
    throw codeError('CATEGORY_NOT_INCOME', 'Category must be an income category');
  }
  if (category.archived) {
    throw codeError('CATEGORY_ARCHIVED', 'Category is archived');
  }

  return category;
}

// Position at the end of `date` (operations dated on or before it); no date = today's position.
export function positionAt(
  operations: {
    createdAt: Date;
    date: string;
    id: string;
    quantity: Decimal8;
    total: number;
    type: InvestmentOperationType;
  }[],
  date?: string,
): Decimal8 {
  return calculatePosition(
    date ? operations.filter((operation) => operation.date <= date) : operations,
  ).quantity;
}

// FR 7-9: the form defaults. A default that is not usable any more (archived, deleted, not writable) starts empty.
export async function resolveIncomeDefaults(
  incomes: IIncomeRepository,
  investment: IInvestmentRepository,
  owners: OwnerAccess[],
  asset: AssetDetail,
  options: { exDate?: string; type?: InvestmentIncomeType },
): Promise<IncomeDefaults> {
  const type = options.type ?? defaultIncomeType(asset.assetClass);
  const defaultAccountId = await incomes.findDefaultAccountId(asset.id);
  const account = defaultAccountId
    ? await resolveIncomeAccount(investment, owners, defaultAccountId, asset.currency).catch(
        () => undefined,
      )
    : undefined;
  const lastCategoryId = await incomes.findLastIncomeCategoryId(asset.owner, asset.ownerId, type);
  const category = lastCategoryId
    ? await resolveIncomeCategory(incomes, account ?? asset, lastCategoryId).catch(() => undefined)
    : undefined;

  return {
    accountId: account?.id ?? null,
    categoryId: category?.id ?? null,
    currency: asset.currency,
    quantity: positionAt(asset.operations, options.exDate).toString(),
    type,
    withholdingRate: bpsToRate(withholdingBps(type, asset.assetClass)),
  };
}

// FR 10, 12, 15, 19: validates the account and the category, then writes the income and its row in one transaction.
export function assertPending(status: string): void {
  if (status !== 'PENDING') {
    throw new ConflictException('The suggestion is no longer pending');
  }
}
export async function persistIncome(
  incomes: IIncomeRepository,
  investment: IInvestmentRepository,
  owners: OwnerAccess[],
  asset: AssetDetail,
  draft: IncomeDraft,
): Promise<IncomeView> {
  const notes = normalizeIncomeNotes(draft.notes);
  const account = await resolveIncomeAccount(investment, owners, draft.accountId, asset.currency);

  await resolveIncomeCategory(incomes, account, draft.categoryId);

  const incomeId = await incomes.writeIncome({
    accountId: draft.accountId,
    amountPerUnit: draft.amountPerUnit?.toString() ?? null,
    assetId: asset.id,
    assetLabel: asset.ticker ?? asset.name,
    categoryId: draft.categoryId,
    createdBy: draft.createdBy,
    currency: asset.currency,
    exDate: draft.exDate,
    incomeId: draft.incomeId,
    netAmount: draft.netAmount,
    notes,
    paid: draft.status === 'RECEIVED',
    paymentDate: draft.paymentDate,
    quantity: draft.quantity?.toString() ?? null,
    suggestionId: draft.suggestionId,
    type: draft.type,
  });
  const saved = await incomes.findIncomeById(incomeId);

  if (!saved) {
    throw new NotFoundException();
  }

  return toIncomeView(saved);
}

// FR 6, 10: status from the row, overdue = planned with a payment date before today, display-only withholding.
export function toIncomeView(income: IncomeEntity, today: string = todayInSaoPaulo()): IncomeView {
  const bps = withholdingBps(income.type, income.assetClass);
  const estimate = estimateIncome(income.netAmount, bps);
  const status: IncomeStatus = income.paid ? 'RECEIVED' : 'PLANNED';

  return {
    estimatedGross: estimate.gross,
    estimatedWithheld: estimate.withheld,
    income,
    overdue: status === 'PLANNED' && income.paymentDate < today,
    status,
    withholdingRate: bpsToRate(bps),
  };
}
