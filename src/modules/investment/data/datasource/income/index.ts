import { Prisma } from '@db/client';
import {
  InvestmentMapper,
  POSITION_SELECT,
} from '@investment/data/datasource/mapper/InvestmentMapper';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { unitStepOf } from '@investment/domain/service/CorporateEventMath';
import { calculatePosition } from '@investment/domain/service/PositionCalculator';

// Spec 107 FR 26: a pending suggestion follows the position at its ex-date. Runs in the transaction of every
// operation write; a suggestion whose position fell to zero is dropped (the job may suggest it again later).
export async function recomputeSuggestions(
  tx: Prisma.TransactionClient,
  assetId: string,
): Promise<void> {
  const pending = await tx.investmentIncomeSuggestion.findMany({
    select: { event: { select: { ex_date: true } }, id: true, quantity: true },
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
    const exDate = suggestion.event.ex_date.toISOString().slice(0, 10);
    const position = calculatePosition(
      operations
        .filter((row) => row.date.toISOString().slice(0, 10) <= exDate)
        .map((row) => InvestmentMapper.toPositionOperation(row)),
      { step },
    );

    if (!position.quantity.isPositive()) {
      await tx.investmentIncomeSuggestion.delete({ where: { id: suggestion.id } });
    } else if (position.quantity.toFixed8() !== suggestion.quantity.toFixed(8)) {
      await tx.investmentIncomeSuggestion.update({
        data: { quantity: position.quantity.toFixed8() },
        where: { id: suggestion.id },
      });
    }
  }
}
