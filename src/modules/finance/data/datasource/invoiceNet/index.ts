import { ConflictException } from '@nestjs/common';

import { Prisma, TransactionType } from '@db/client';

// The invoice NET is purchases (EXPENSE) minus every credit (INCOME: refunds, discounts, early payments).
// Card credits are stored with a positive value, so a plain SUM would add them instead of subtracting.
export async function assertNetUnchanged(
  tx: Prisma.TransactionClient,
  creditCardId: string,
  invoiceMonth: string,
  expectedNet: number,
): Promise<void> {
  const rows = await tx.financialTransaction.groupBy({
    _sum: { value: true },
    by: ['type'],
    where: { credit_card_id: creditCardId, invoice_month: invoiceMonth },
  });
  const net = rows.reduce(
    (sum, row) => sum + (row.type === TransactionType.INCOME ? -1 : 1) * (row._sum.value ?? 0),
    0,
  );

  if (net !== expectedNet) {
    throw new ConflictException('Invoice changed, reload and try again');
  }
}
