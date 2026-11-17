import { NotFoundException } from '@nestjs/common';

import { Prisma } from '@db/client';
import {
  assertPositionValid,
  recomputeEventSuggestions,
} from '@investment/data/datasource/corporateEvent';
import {
  applyDeltas,
  ledgerDeltasFor,
  LINKED_SELECT,
  lockAccounts,
  lockAsset,
  toLinkedRow,
} from '@investment/data/datasource/financeLink';
import { recomputeSuggestions } from '@investment/data/datasource/income';
import { syncIncomeSeries } from '@investment/data/datasource/incomeSeries';
import {
  InvestmentMapper,
  POSITION_SELECT,
} from '@investment/data/datasource/mapper/InvestmentMapper';
import { WriteConversionDatasourceParams } from '@investment/data/repository/datasource/IInvestmentDatasource';
import { INVESTMENT_REDEMPTION_CATEGORY_ID } from '@investment/domain/entity/SystemCategories';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { ConversionLaterOperationsError } from '@investment/domain/error/ConversionLaterOperationsError';
import { NoPositionError } from '@investment/domain/error/NoPositionError';
import { computeConversion } from '@investment/domain/service/ConversionMath';
import { unitStepOf } from '@investment/domain/service/CorporateEventMath';
import { calculatePosition } from '@investment/domain/service/PositionCalculator';
import { Decimal8 } from '@shared/infra/decimal';

const OPERATION_INCLUDE = { transaction: { select: LINKED_SELECT } } as const;

// Spec 112 FR 6-13, 15-18: the whole conversion in the caller's transaction. Both assets are locked in id order, the
// snapshot is computed from the origin's position as of the record date (so it can't go stale), and the destination
// is re-run by the position check.
export async function writeConversionIn(
  tx: Prisma.TransactionClient,
  params: WriteConversionDatasourceParams,
): Promise<string> {
  const existing = params.conversion_id
    ? await tx.investmentConversion.findUnique({
        include: { operations: { include: OPERATION_INCLUDE } },
        where: { id: params.conversion_id },
      })
    : null;

  if (params.conversion_id && !existing) {
    throw new NotFoundException('Conversion not found');
  }

  const fromId = existing?.from_asset_id ?? params.from_asset_id;
  const toId =
    existing?.to_asset_id ??
    ('asset_id' in params.destination
      ? params.destination.asset_id
      : (await tx.investmentAsset.create({ data: params.destination.new_asset })).id);

  for (const id of [fromId, toId].sort()) {
    await lockAsset(tx, id);
  }

  const existingOut = existing?.operations.find((row) => row.type === 'CONVERSION_OUT');
  const existingIn = existing?.operations.find((row) => row.type === 'CONVERSION_IN');
  const date = InvestmentMapper.toCalendarDate(params.date);
  const origin = await tx.investmentAsset.findUnique({
    select: { asset_class: true, ticker: true },
    where: { id: fromId },
  });
  const rows = await tx.investmentOperation.findMany({
    select: { ...POSITION_SELECT },
    where: { asset_id: fromId, ...(existingOut ? { id: { not: existingOut.id } } : {}) },
  });
  const later = rows.filter((row) => InvestmentMapper.toCalendarDate(row.date) > date);

  if (later.length > 0) {
    throw new ConversionLaterOperationsError(
      origin?.ticker ?? null,
      date,
      later.map((row) => ({
        date: InvestmentMapper.toCalendarDate(row.date),
        id: row.id,
        type: row.type,
      })),
    );
  }

  const step = unitStepOf(InvestmentAssetClass[origin?.asset_class ?? 'PRIVATE']);
  const position = calculatePosition(
    rows.map((row) => InvestmentMapper.toPositionOperation(row)),
    { step },
  );

  if (!position.quantity.isPositive()) {
    throw new NoPositionError(date);
  }

  const cash =
    params.cash_amount && params.cash_reference_unit_value
      ? {
          amount: params.cash_amount,
          referenceUnitValue: Decimal8.parse(params.cash_reference_unit_value),
        }
      : null;
  const result = computeConversion({
    cash,
    costOut: position.cost,
    quantityOut: position.quantity,
    ratioFrom: Decimal8.parse(params.ratio_from),
    ratioTo: Decimal8.parse(params.ratio_to),
    step,
  });
  const conversionFields = {
    cash_amount: cash?.amount ?? null,
    cash_reference_unit_value: cash ? params.cash_reference_unit_value : null,
    date: params.date,
    ratio_from: params.ratio_from,
    ratio_to: params.ratio_to,
  };
  const conversionId = existing
    ? (await tx.investmentConversion.update({ data: conversionFields, where: { id: existing.id } }))
        .id
    : (
        await tx.investmentConversion.create({
          data: { ...conversionFields, from_asset_id: fromId, to_asset_id: toId },
        })
      ).id;
  const link = params.generate_transaction && !!cash && !!params.account_id;
  const outFields = {
    account_id: link ? params.account_id : null,
    cash_cost: cash ? result.cashCost : null,
    conversion_cost: position.cost,
    date: params.date,
    fees_total: cash ? 0 : null,
    generate_transaction: link,
    gross: cash?.amount ?? null,
    quantity: position.quantity.toFixed8(),
    total: cash?.amount ?? null,
  };
  const inFields = {
    conversion_cost: result.costIn,
    date: params.date,
    fraction_cost: result.fractionCost,
    fraction_quantity: result.fractionQuantity.toFixed8(),
    quantity: result.quantityIn.toFixed8(),
  };

  await lockAccounts(
    tx,
    [existingOut?.account_id, params.account_id].filter((id): id is string => !!id),
  );

  const out = existingOut
    ? await tx.investmentOperation.update({ data: outFields, where: { id: existingOut.id } })
    : await tx.investmentOperation.create({
        data: {
          ...outFields,
          asset_id: fromId,
          conversion_id: conversionId,
          type: 'CONVERSION_OUT',
        },
      });

  if (existingIn) {
    await tx.investmentOperation.update({ data: inFields, where: { id: existingIn.id } });
  } else {
    await tx.investmentOperation.create({
      data: {
        ...inFields,
        asset_id: toId,
        conversion_id: conversionId,
        generate_transaction: false,
        type: 'CONVERSION_IN',
      },
    });
  }

  await syncCashRow(tx, {
    accountId: link ? params.account_id : null,
    cashAmount: cash?.amount ?? 0,
    currency: params.currency,
    date: params.date,
    description: params.asset_label,
    existing: existingOut,
    operationId: out.id,
  });

  if (!existing) {
    await tx.investmentAsset.update({
      data: { archived_at: new Date(), status: 'ARCHIVED' },
      where: { id: fromId },
    });
  }

  await dismissLaterSuggestions(tx, fromId, params.date);
  await assertPositionValid(tx, fromId);
  await assertPositionValid(tx, toId);
  await recomputeSuggestions(tx, toId);
  await syncIncomeSeries(tx, fromId);
  await syncIncomeSeries(tx, toId);
  await recomputeEventSuggestions(tx, toId);

  return conversionId;
}

// Spec 112 FR 20: both operations, the cash row, the destination's fraction sale and its row go; the origin is active
// again and both positions are re-run (a later sell of the converted quotas makes the delete fail).
export async function deleteConversionIn(tx: Prisma.TransactionClient, id: string): Promise<void> {
  const conversion = await tx.investmentConversion.findUnique({
    include: { operations: { include: OPERATION_INCLUDE } },
    where: { id },
  });

  if (!conversion) {
    return;
  }

  for (const assetId of [conversion.from_asset_id, conversion.to_asset_id].sort()) {
    await lockAsset(tx, assetId);
  }

  const incoming = conversion.operations.find((row) => row.type === 'CONVERSION_IN');
  const sale = incoming
    ? await tx.investmentOperation.findUnique({
        include: OPERATION_INCLUDE,
        where: { fraction_of_operation_id: incoming.id },
      })
    : null;
  const removed = [...(sale ? [sale] : []), ...conversion.operations];

  await lockAccounts(
    tx,
    removed
      .map((operation) => operation.transaction?.account_id)
      .filter((accountId): accountId is string => !!accountId),
  );

  for (const operation of removed) {
    await tx.investmentOperation.delete({ where: { id: operation.id } });

    if (operation.transaction_id) {
      await tx.financialTransaction.delete({ where: { id: operation.transaction_id } });
    }

    await applyDeltas(tx, ledgerDeltasFor(toLinkedRow(operation.transaction), undefined));
  }

  await tx.investmentConversion.delete({ where: { id } });
  await tx.investmentAsset.update({
    data: { archived_at: null, status: 'ACTIVE' },
    where: { id: conversion.from_asset_id },
  });
  await assertPositionValid(tx, conversion.from_asset_id);
  await assertPositionValid(tx, conversion.to_asset_id);
  await recomputeSuggestions(tx, conversion.to_asset_id);
  await syncIncomeSeries(tx, conversion.from_asset_id);
  await syncIncomeSeries(tx, conversion.to_asset_id);
  await recomputeEventSuggestions(tx, conversion.to_asset_id);
}

// Spec 112 FR 17: suggestions of the origin dated after the record date are no longer wanted.
interface CashRowParams {
  accountId: null | string;
  cashAmount: number;
  currency: string;
  date: Date;
  description: string;
  existing:
    | {
        transaction: { account_id: null | string; type: string; value: number } | null;
        transaction_id: null | string;
      }
    | undefined;
  operationId: string;
}

async function dismissLaterSuggestions(
  tx: Prisma.TransactionClient,
  assetId: string,
  date: Date,
): Promise<void> {
  await tx.investmentIncomeSuggestion.updateMany({
    data: { status: 'DISMISSED' },
    where: { asset_id: assetId, event: { ex_date: { gt: date } }, status: 'PENDING' },
  });
  await tx.investmentEventSuggestion.updateMany({
    data: { status: 'DISMISSED' },
    where: { asset_id: assetId, event: { record_date: { gt: date } }, status: 'PENDING' },
  });
}

// Spec 112 FR 15-16: the cash part is an INVESTMENT_REDEMPTION row (INCOME, paid) linked to the CONVERSION_OUT and
// the ledger moves by the difference; no account or no cash part removes the row.
async function syncCashRow(tx: Prisma.TransactionClient, params: CashRowParams): Promise<void> {
  const before = toLinkedRow(params.existing?.transaction ?? null);
  let transactionId = params.existing?.transaction_id ?? null;
  let after: ReturnType<typeof toLinkedRow>;

  if (params.accountId) {
    const account = await tx.financialAccount.findUnique({
      select: { owner: true, owner_id: true },
      where: { id: params.accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const row = {
      account_id: params.accountId,
      category_id: INVESTMENT_REDEMPTION_CATEGORY_ID,
      currency: params.currency,
      date: params.date,
      description: params.description,
      owner: account.owner,
      owner_id: account.owner_id,
      paid: true,
      type: 'INCOME',
      value: params.cashAmount,
    } as const;

    if (transactionId) {
      await tx.financialTransaction.update({ data: row, where: { id: transactionId } });
    } else {
      transactionId = (await tx.financialTransaction.create({ data: row })).id;
    }

    after = { accountId: params.accountId, type: 'INCOME', value: params.cashAmount };
  } else if (transactionId) {
    await tx.financialTransaction.delete({ where: { id: transactionId } });
    transactionId = null;
  }

  if (transactionId !== (params.existing?.transaction_id ?? null)) {
    await tx.investmentOperation.update({
      data: { transaction_id: transactionId },
      where: { id: params.operationId },
    });
  }

  await applyDeltas(tx, ledgerDeltasFor(before, after));
}
