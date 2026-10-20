import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinancePrepaymentMapper } from '@finance/data/datasource/mapper/FinancePrepaymentMapper';
import { IFinancePrepaymentDatasource } from '@finance/data/repository/datasource/IFinancePrepaymentDatasource';
import PrepaymentEntity from '@finance/domain/entity/PrepaymentEntity';
import { IFinancePrepaymentRepository, PrepayRepositoryParams } from '@finance/domain/repository';

@Injectable()
export class FinancePrepaymentRepository implements IFinancePrepaymentRepository {
  constructor(
    @Inject('IFinancePrepaymentDatasource')
    private readonly prepaymentDatasource: IFinancePrepaymentDatasource,
  ) {}

  async findByPlanId(planId: string): Promise<PrepaymentEntity | undefined> {
    const result = await this.prepaymentDatasource.findByPlanId(planId);

    return result ? FinancePrepaymentMapper.toDomain(result) : undefined;
  }

  async prepay(params: PrepayRepositoryParams): Promise<PrepaymentEntity> {
    const result = await this.prepaymentDatasource.prepay({
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      currency: params.currency,
      date: fromCalendarDate(params.date),
      discount: params.discount,
      discount_description: params.discountDescription,
      owner: params.owner,
      owner_id: params.ownerId,
      plan_id: params.planId,
      target_invoice_month: params.targetInvoiceMonth,
    });

    return FinancePrepaymentMapper.toDomain(result);
  }

  async undoPrepayment(planId: string): Promise<void> {
    await this.prepaymentDatasource.undo(planId);
  }
}
