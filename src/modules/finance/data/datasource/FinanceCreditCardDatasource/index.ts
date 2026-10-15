import { Injectable } from '@nestjs/common';

import { AccountStatus, FinancialCreditCard } from '@db/client';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  CreateCreditCardDatasourceParams,
  ExistsCreditCardDatasourceParams,
  IFinanceCreditCardDatasource,
  UpdateCreditCardDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceCreditCardDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class FinanceCreditCardDatasource implements IFinanceCreditCardDatasource {
  constructor(private readonly db: Database) {}

  async create(params: CreateCreditCardDatasourceParams): Promise<FinancialCreditCard> {
    return this.db.client.financialCreditCard.create({ data: params });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.financialCreditCard.deleteMany({ where: { id } });
  }

  async exists(params: ExistsCreditCardDatasourceParams): Promise<boolean> {
    const found = await this.db.client.financialCreditCard.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return found !== null;
  }

  async findById(id: string): Promise<FinancialCreditCard | null> {
    return this.db.client.financialCreditCard.findUnique({ where: { id } });
  }

  async findByOwners(
    owners: OwnerAccess[],
    status?: AccountStatus,
  ): Promise<FinancialCreditCard[]> {
    return this.db.client.financialCreditCard.findMany({
      where: status === undefined ? toOwnerWhere(owners) : { ...toOwnerWhere(owners), status },
    });
  }

  async update(params: UpdateCreditCardDatasourceParams): Promise<FinancialCreditCard> {
    return this.db.client.financialCreditCard.update({
      data: {
        brand: params.brand,
        closing_day: params.closing_day,
        color: params.color,
        due_day: params.due_day,
        last_digits: params.last_digits,
        limit: params.limit,
        owner: params.owner,
        owner_id: params.owner_id,
        payment_day: params.payment_day,
        status: params.status,
        title: params.title,
      },
      where: { id: params.id },
    });
  }
}
