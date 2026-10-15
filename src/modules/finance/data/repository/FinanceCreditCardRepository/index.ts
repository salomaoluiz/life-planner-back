import { Inject, Injectable } from '@nestjs/common';

import { FinanceCreditCardMapper } from '@finance/data/datasource/mapper/FinanceCreditCardMapper';
import { IFinanceCreditCardDatasource } from '@finance/data/repository/datasource/IFinanceCreditCardDatasource';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import {
  CreateCreditCardRepositoryParams,
  IFinanceCreditCardRepository,
  UpdateCreditCardRepositoryParams,
} from '@finance/domain/repository';

@Injectable()
export class FinanceCreditCardRepository implements IFinanceCreditCardRepository {
  constructor(
    @Inject('IFinanceCreditCardDatasource')
    private readonly creditCardDatasource: IFinanceCreditCardDatasource,
  ) {}

  async createCreditCard(params: CreateCreditCardRepositoryParams): Promise<CreditCardEntity> {
    const result = await this.creditCardDatasource.create({
      brand: params.brand,
      closing_day: params.closingDay,
      color: params.color,
      due_day: params.dueDay,
      last_digits: params.lastDigits,
      limit: params.limit,
      owner: params.owner,
      owner_id: params.ownerId,
      payment_day: params.paymentDay,
      status: params.status,
      title: params.title,
    });

    return FinanceCreditCardMapper.toDomain(result);
  }

  async deleteCreditCard(id: string): Promise<void> {
    await this.creditCardDatasource.delete(id);
  }

  async existsByOwner(access: OwnerAccess): Promise<boolean> {
    return this.creditCardDatasource.exists({ owner: access.owner, owner_id: access.ownerId });
  }

  async findCreditCardById(id: string): Promise<CreditCardEntity | undefined> {
    const result = await this.creditCardDatasource.findById(id);

    return result ? FinanceCreditCardMapper.toDomain(result) : undefined;
  }

  async findCreditCards(
    owners: OwnerAccess[],
    status?: AccountStatus,
  ): Promise<CreditCardEntity[]> {
    const result = await this.creditCardDatasource.findByOwners(owners, status);

    return result.map((row) => FinanceCreditCardMapper.toDomain(row));
  }

  async updateCreditCard(params: UpdateCreditCardRepositoryParams): Promise<CreditCardEntity> {
    const result = await this.creditCardDatasource.update({
      brand: params.brand,
      closing_day: params.closingDay,
      color: params.color,
      due_day: params.dueDay,
      id: params.id,
      last_digits: params.lastDigits,
      limit: params.limit,
      owner: params.owner,
      owner_id: params.ownerId,
      payment_day: params.paymentDay,
      status: params.status,
      title: params.title,
    });

    return FinanceCreditCardMapper.toDomain(result);
  }
}
