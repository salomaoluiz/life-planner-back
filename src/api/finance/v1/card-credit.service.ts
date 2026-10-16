import { Injectable } from '@nestjs/common';

import {
  CreateEarlyPaymentApiInput,
  CreateRefundApiInput,
  EarlyPaymentOutputShape,
  RefundOutputShape,
  UpdateEarlyPaymentApiInput,
  UpdateRefundApiInput,
} from '@api/finance/v1/dto/card-credit.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { resolveToday } from '@api/finance/v1/finance-query';
import { CreateCardEarlyPaymentUseCase } from '@finance/application/use-case/CreateCardEarlyPaymentUseCase';
import { CreateCardRefundUseCase } from '@finance/application/use-case/CreateCardRefundUseCase';
import { DeleteCardEarlyPaymentUseCase } from '@finance/application/use-case/DeleteCardEarlyPaymentUseCase';
import { DeleteCardRefundUseCase } from '@finance/application/use-case/DeleteCardRefundUseCase';
import { UpdateCardEarlyPaymentUseCase } from '@finance/application/use-case/UpdateCardEarlyPaymentUseCase';
import { UpdateCardRefundUseCase } from '@finance/application/use-case/UpdateCardRefundUseCase';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';

function toEarlyPaymentOutput(row: TransactionEntity): EarlyPaymentOutputShape {
  return {
    accountId: row.paidFromAccountId ?? undefined,
    accountTransactionId: row.paidFromTransactionId ?? undefined,
    date: row.date,
    description: row.description,
    id: row.id,
    invoiceMonth: row.invoiceMonth as string,
    // An early payment always has its method.
    method: row.paymentMethod as NonNullable<TransactionEntity['paymentMethod']>,
    value: row.value,
  };
}
function toRefundOutput(row: TransactionEntity): RefundOutputShape {
  return {
    creditCardId: row.creditCardId as string,
    date: row.date,
    description: row.description,
    id: row.id,
    invoiceMonth: row.invoiceMonth as string,
    refundedPlanId: row.refundedPlanId,
    refundedTransactionId: row.refundedTransactionId,
    value: row.value,
  };
}

@Injectable()
export class CardCreditService {
  constructor(
    private readonly createCardEarlyPaymentUseCase: CreateCardEarlyPaymentUseCase,
    private readonly createCardRefundUseCase: CreateCardRefundUseCase,
    private readonly deleteCardEarlyPaymentUseCase: DeleteCardEarlyPaymentUseCase,
    private readonly deleteCardRefundUseCase: DeleteCardRefundUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly updateCardEarlyPaymentUseCase: UpdateCardEarlyPaymentUseCase,
    private readonly updateCardRefundUseCase: UpdateCardRefundUseCase,
  ) {}

  async createEarlyPayment(
    userId: string,
    creditCardId: string,
    input: CreateEarlyPaymentApiInput,
    today?: string,
  ): Promise<EarlyPaymentOutputShape> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    return toEarlyPaymentOutput(
      await this.createCardEarlyPaymentUseCase.execute({
        ...input,
        accessibleOwners,
        creditCardId,
        today: resolveToday(input.today ?? today),
      }),
    );
  }

  async createRefund(
    userId: string,
    creditCardId: string,
    input: CreateRefundApiInput,
    today?: string,
  ): Promise<RefundOutputShape> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    return toRefundOutput(
      await this.createCardRefundUseCase.execute({
        ...input,
        accessibleOwners,
        creditCardId,
        today: resolveToday(input.today ?? today),
      }),
    );
  }

  async deleteEarlyPayment(userId: string, creditCardId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteCardEarlyPaymentUseCase.execute({ accessibleOwners, creditCardId, id });
  }

  async deleteRefund(userId: string, creditCardId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteCardRefundUseCase.execute({ accessibleOwners, creditCardId, id });
  }

  async updateEarlyPayment(
    userId: string,
    creditCardId: string,
    id: string,
    input: UpdateEarlyPaymentApiInput,
    today?: string,
  ): Promise<EarlyPaymentOutputShape> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    return toEarlyPaymentOutput(
      await this.updateCardEarlyPaymentUseCase.execute({
        ...input,
        accessibleOwners,
        creditCardId,
        id,
        today: resolveToday(input.today ?? today),
      }),
    );
  }

  async updateRefund(
    userId: string,
    creditCardId: string,
    id: string,
    input: UpdateRefundApiInput,
    today?: string,
  ): Promise<RefundOutputShape> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    return toRefundOutput(
      await this.updateCardRefundUseCase.execute({
        ...input,
        accessibleOwners,
        creditCardId,
        id,
        today: resolveToday(input.today ?? today),
      }),
    );
  }
}
