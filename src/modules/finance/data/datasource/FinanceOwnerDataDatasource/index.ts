import { Injectable } from '@nestjs/common';

import {
  DeleteAllByOwnerDatasourceParams,
  IFinanceOwnerDataDatasource,
} from '@finance/data/repository/datasource/IFinanceOwnerDataDatasource';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class FinanceOwnerDataDatasource implements IFinanceOwnerDataDatasource {
  constructor(private readonly db: Database) {}

  // Payments first (they point at transactions, cards and accounts), then transactions (their FKs to account, card and category
  // are RESTRICT), then cards; a category's children cascade, and deleting by owner removes them anyway.
  async deleteAllByOwner(params: DeleteAllByOwnerDatasourceParams): Promise<number> {
    const where = { owner: params.owner, owner_id: params.owner_id };

    const results = await this.db.client.$transaction([
      this.db.client.financialInvoicePayment.deleteMany({ where }),
      this.db.client.financialTransaction.deleteMany({ where }),
      this.db.client.financialCreditCard.deleteMany({ where }),
      this.db.client.financialCategory.deleteMany({ where }),
      this.db.client.financialAccount.deleteMany({ where }),
    ]);

    return results.reduce((total, result) => total + result.count, 0);
  }
}
