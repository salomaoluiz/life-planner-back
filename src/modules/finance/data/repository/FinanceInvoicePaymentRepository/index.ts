import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceInvoicePaymentMapper } from '@finance/data/datasource/mapper/FinanceInvoicePaymentMapper';
import { IFinanceInvoicePaymentDatasource } from '@finance/data/repository/datasource/IFinanceInvoicePaymentDatasource';
import InvoicePaymentEntity from '@finance/domain/entity/InvoicePaymentEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  IFinanceInvoicePaymentRepository,
  PayInvoiceRepositoryParams,
} from '@finance/domain/repository';

@Injectable()
export class FinanceInvoicePaymentRepository implements IFinanceInvoicePaymentRepository {
  constructor(
    @Inject('IFinanceInvoicePaymentDatasource')
    private readonly paymentDatasource: IFinanceInvoicePaymentDatasource,
  ) {}

  async existsByOwner(access: OwnerAccess): Promise<boolean> {
    return this.paymentDatasource.exists({ owner: access.owner, owner_id: access.ownerId });
  }

  async findByCardAndMonth(
    creditCardId: string,
    invoiceMonth: string,
  ): Promise<InvoicePaymentEntity | undefined> {
    const result = await this.paymentDatasource.findByCardAndMonth(creditCardId, invoiceMonth);

    return result ? FinanceInvoicePaymentMapper.toDomain(result) : undefined;
  }

  async findByCardIds(creditCardIds: string[]): Promise<InvoicePaymentEntity[]> {
    const result = await this.paymentDatasource.findByCardIds(creditCardIds);

    return result.map((row) => FinanceInvoicePaymentMapper.toDomain(row));
  }

  async payInvoice(params: PayInvoiceRepositoryParams): Promise<InvoicePaymentEntity> {
    const result = await this.paymentDatasource.pay({
      account_id: params.accountId,
      account_owner: params.accountOwner?.owner,
      account_owner_id: params.accountOwner?.ownerId,
      amount: params.amount,
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      description: params.description,
      invoice_month: params.invoiceMonth,
      method: params.method,
      owner: params.owner,
      owner_id: params.ownerId,
      paid_on: fromCalendarDate(params.paidOn),
    });

    return FinanceInvoicePaymentMapper.toDomain(result);
  }

  async undoPayment(creditCardId: string, invoiceMonth: string): Promise<void> {
    await this.paymentDatasource.undo(creditCardId, invoiceMonth);
  }
}
