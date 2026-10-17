import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import { IFinanceCardCreditDatasource } from '@finance/data/repository/datasource/IFinanceCardCreditDatasource';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import {
  CardCreditAccount,
  CreateEarlyPaymentRepositoryParams,
  CreateRefundRepositoryParams,
  IFinanceCardCreditRepository,
  UpdateEarlyPaymentRepositoryParams,
  UpdateRefundRepositoryParams,
} from '@finance/domain/repository';

@Injectable()
export class FinanceCardCreditRepository implements IFinanceCardCreditRepository {
  constructor(
    @Inject('IFinanceCardCreditDatasource')
    private readonly cardCreditDatasource: IFinanceCardCreditDatasource,
  ) {}

  async countRefundsByPlanId(planId: string): Promise<number> {
    return this.cardCreditDatasource.countRefundsByPlanId(planId);
  }

  async countRefundsByTransactionId(transactionId: string): Promise<number> {
    return this.cardCreditDatasource.countRefundsByTransactionId(transactionId);
  }

  async createEarlyPayment(params: CreateEarlyPaymentRepositoryParams): Promise<TransactionEntity> {
    const result = await this.cardCreditDatasource.createEarlyPayment({
      account: toAccount(params.account),
      account_category_id: params.accountCategoryId,
      account_description: params.accountDescription,
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      date: fromCalendarDate(params.date),
      description: params.description,
      expected_net: params.expectedNet,
      invoice_month: params.invoiceMonth,
      method: params.method,
      owner: params.owner,
      owner_id: params.ownerId,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }

  async createRefund(params: CreateRefundRepositoryParams): Promise<TransactionEntity> {
    const result = await this.cardCreditDatasource.createRefund({
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      date: fromCalendarDate(params.date),
      description: params.description,
      invoice_month: params.invoiceMonth,
      max_linked: params.maxLinked,
      owner: params.owner,
      owner_id: params.ownerId,
      refunded_plan_id: params.refundedPlanId,
      refunded_transaction_id: params.refundedTransactionId,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }

  async deleteCredit(id: string): Promise<void> {
    await this.cardCreditDatasource.deleteCredit(id);
  }

  async updateEarlyPayment(params: UpdateEarlyPaymentRepositoryParams): Promise<TransactionEntity> {
    const result = await this.cardCreditDatasource.updateEarlyPayment({
      account: toAccount(params.account),
      account_description: params.accountDescription,
      date: params.date === undefined ? undefined : fromCalendarDate(params.date),
      description: params.description,
      expected_net: params.expectedNet,
      id: params.id,
      invoice_month: params.invoiceMonth,
      method: params.method,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }

  async updateRefund(params: UpdateRefundRepositoryParams): Promise<TransactionEntity> {
    const result = await this.cardCreditDatasource.updateRefund({
      date: params.date === undefined ? undefined : fromCalendarDate(params.date),
      description: params.description,
      id: params.id,
      invoice_month: params.invoiceMonth,
      max_linked: params.maxLinked,
      refunded_plan_id: params.refundedPlanId,
      refunded_transaction_id: params.refundedTransactionId,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }
}

function toAccount(account?: CardCreditAccount) {
  return account ? { id: account.id, owner: account.owner, owner_id: account.ownerId } : undefined;
}
