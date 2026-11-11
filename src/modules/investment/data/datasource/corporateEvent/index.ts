import { Prisma } from '@db/client';
import {
  InvestmentMapper,
  POSITION_SELECT,
} from '@investment/data/datasource/mapper/InvestmentMapper';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { FractionSaleBreaksError } from '@investment/domain/error/FractionSaleBreaksError';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { NoPositionError } from '@investment/domain/error/NoPositionError';
import { fractionUnitPrice, unitStepOf } from '@investment/domain/service/CorporateEventMath';
import { calculatePosition } from '@investment/domain/service/PositionCalculator';
import { Decimal8 } from '@shared/infra/decimal';

const SELECT = { ...POSITION_SELECT, gross: true } as const;

// Spec 102 FR 17 and spec 108 FR 13, 14, 18: re-runs the calculator over every operation of the asset inside the
// write transaction. Refuses a negative position, an event where no shares are held and a fraction sale whose
// event no longer leaves a fraction; keeps the quantity and unit price of the sales in step with their fraction.
export async function assertPositionValid(
  tx: Prisma.TransactionClient,
  assetId: string,
): Promise<void> {
  const asset = await tx.investmentAsset.findUnique({
    select: { asset_class: true },
    where: { id: assetId },
  });
  const rows = await tx.investmentOperation.findMany({
    select: SELECT,
    where: { asset_id: assetId },
  });
  const result = calculatePosition(
    rows.map((row) => InvestmentMapper.toPositionOperation(row)),
    { step: unitStepOf(InvestmentAssetClass[asset?.asset_class ?? 'PRIVATE']) },
  );

  if (result.negativeAt) {
    throw new NegativePositionError(result.negativeAt.date, result.negativeAt.operationId);
  }
  if (result.noPositionAt) {
    throw new NoPositionError(result.noPositionAt.date);
  }

  for (const row of rows) {
    if (!row.fraction_of_operation_id) {
      continue;
    }

    const fraction = result.perEvent.get(row.fraction_of_operation_id)?.fractionQuantity;

    if (!fraction?.isPositive()) {
      throw new FractionSaleBreaksError(InvestmentMapper.toCalendarDate(row.date));
    }
    if (!row.quantity || fraction.toFixed8() !== row.quantity.toFixed(8)) {
      await tx.investmentOperation.update({
        data: {
          quantity: fraction.toFixed8(),
          unit_price: fractionUnitPrice(row.gross ?? 0, fraction).toFixed8(),
        },
        where: { id: row.id },
      });
    }
  }
}

// Spec 108 FR 25: a pending event suggestion follows the position at its data-com. Runs in the transaction of
// every operation write; a suggestion whose position fell to zero is dropped.
export async function recomputeEventSuggestions(
  tx: Prisma.TransactionClient,
  assetId: string,
): Promise<void> {
  const pending = await tx.investmentEventSuggestion.findMany({
    select: { event: { select: { record_date: true } }, id: true, quantity: true },
    where: { asset_id: assetId, status: 'PENDING' },
  });

  if (pending.length === 0) {
    return;
  }

  const asset = await tx.investmentAsset.findUnique({
    select: { asset_class: true },
    where: { id: assetId },
  });
  const operations = await tx.investmentOperation.findMany({
    select: POSITION_SELECT,
    where: { asset_id: assetId },
  });
  const step = unitStepOf(InvestmentAssetClass[asset?.asset_class ?? 'PRIVATE']);

  for (const suggestion of pending) {
    const recordDate = InvestmentMapper.toCalendarDate(suggestion.event.record_date);
    const quantity: Decimal8 = calculatePosition(
      operations
        .filter((row) => InvestmentMapper.toCalendarDate(row.date) <= recordDate)
        .map((row) => InvestmentMapper.toPositionOperation(row)),
      { step },
    ).quantity;

    if (!quantity.isPositive()) {
      await tx.investmentEventSuggestion.delete({ where: { id: suggestion.id } });
    } else if (quantity.toFixed8() !== suggestion.quantity.toFixed(8)) {
      await tx.investmentEventSuggestion.update({
        data: { quantity: quantity.toFixed8() },
        where: { id: suggestion.id },
      });
    }
  }
}
