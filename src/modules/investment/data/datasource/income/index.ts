import { Prisma } from '@db/client';
import { InvestmentOperationType } from '@investment/domain/enum';
import { calculatePosition } from '@investment/domain/service/PositionCalculator';
import { Decimal8 } from '@shared/infra/decimal';

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

  const operations = await tx.investmentOperation.findMany({
    select: { created_at: true, date: true, id: true, quantity: true, total: true, type: true },
    where: { asset_id: assetId },
  });

  for (const suggestion of pending) {
    const exDate = suggestion.event.ex_date.toISOString().slice(0, 10);
    const position = calculatePosition(
      operations
        .filter((row) => row.date.toISOString().slice(0, 10) <= exDate)
        .map((row) => ({
          createdAt: row.created_at,
          date: row.date.toISOString().slice(0, 10),
          id: row.id,
          quantity: Decimal8.parse(row.quantity.toFixed(8)),
          total: row.total,
          type: row.type as InvestmentOperationType,
        })),
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
