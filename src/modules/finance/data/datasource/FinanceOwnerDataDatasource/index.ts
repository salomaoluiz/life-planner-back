import { Injectable } from '@nestjs/common';

import {
  DeleteAllByOwnerDatasourceParams,
  IFinanceOwnerDataDatasource,
} from '@finance/data/repository/datasource/IFinanceOwnerDataDatasource';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey } from '@finance/domain/enum';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class FinanceOwnerDataDatasource implements IFinanceOwnerDataDatasource {
  constructor(private readonly db: Database) {}

  // Rows that point at others go first: early payments owed to this owner's debit rows (they may belong to a card
  // of another owner), refunds and early payments, the prepayments (the record and its discount row point at each
  // other), the payments (they point at transactions, cards and accounts), then transactions, installment plans,
  // cards; a category's children cascade, and deleting by owner removes them anyway.
  async deleteAllByOwner(params: DeleteAllByOwnerDatasourceParams): Promise<number> {
    const where = { owner: params.owner, owner_id: params.owner_id };

    return this.db.client.$transaction(async (tx) => {
      const counts = [
        await tx.financialTransaction.deleteMany({
          where: { paid_from_transaction: { is: where } },
        }),
        await tx.financialTransaction.deleteMany({
          where: {
            ...where,
            category_id: {
              in: [
                SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_REFUND],
                SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_EARLY_PAYMENT],
              ],
            },
          },
        }),
        await tx.financialInstallmentPrepayment.updateMany({
          data: { discount_transaction_id: null },
          where,
        }),
        await tx.financialTransaction.deleteMany({
          where: { ...where, prepayment_id: { not: null } },
        }),
        await tx.financialInstallmentPrepayment.deleteMany({ where }),
        await tx.financialInvoicePayment.deleteMany({ where }),
        await tx.financialTransaction.deleteMany({ where }),
        await tx.financialRecurrence.deleteMany({ where }),
        await tx.financialInstallmentPlan.deleteMany({ where }),
        await tx.financialCreditCard.deleteMany({ where }),
        await tx.financialCategory.deleteMany({ where }),
        // Spec 043: the links cascade; an ALL tag is owned by its creator's Personal scope, so it goes with the user.
        await tx.financialTag.deleteMany({ where }),
        await tx.financialAccount.deleteMany({ where }),
      ];

      return counts.reduce((total, result) => total + result.count, 0);
    });
  }
}
