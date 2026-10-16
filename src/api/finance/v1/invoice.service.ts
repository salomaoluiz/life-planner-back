import { Injectable } from '@nestjs/common';

import { todayInSaoPaulo } from '@api/finance/v1/credit-card-today';
import { toInvoiceOutput } from '@api/finance/v1/credit-card.service';
import { PayInvoiceApiInput } from '@api/finance/v1/dto/invoice.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { GetInvoicesForListUseCase } from '@finance/application/use-case/GetInvoicesForListUseCase';
import { GetInvoiceUseCase, InvoiceDetail } from '@finance/application/use-case/GetInvoiceUseCase';
import { PayInvoiceUseCase } from '@finance/application/use-case/PayInvoiceUseCase';
import { UndoInvoicePaymentUseCase } from '@finance/application/use-case/UndoInvoicePaymentUseCase';
import InvoicePaymentEntity from '@finance/domain/entity/InvoicePaymentEntity';

function toDetailOutput({ card, invoice, purchases }: InvoiceDetail) {
  return {
    card: {
      color: card.color,
      id: card.id,
      lastDigits: card.lastDigits,
      owner: card.owner,
      ownerId: card.ownerId,
      title: card.title,
    },
    invoice: toInvoiceOutput(invoice),
    purchases: purchases.map((purchase) => ({
      category: purchase.category.name,
      categoryIcon: purchase.category.icon,
      categoryIconColor: purchase.category.iconColor,
      categoryId: purchase.categoryId,
      date: purchase.date,
      description: purchase.description,
      id: purchase.id,
      installmentCount: purchase.installmentCount,
      installmentNumber: purchase.installmentNumber,
      ownerId: purchase.ownerId,
      value: purchase.value,
    })),
  };
}
function toPaymentOutput(payment: InvoicePaymentEntity) {
  return {
    accountId: payment.accountId,
    accountName: payment.accountName,
    amount: payment.amount,
    creditCardId: payment.creditCardId,
    invoiceMonth: payment.invoiceMonth,
    method: payment.method,
    paidOn: payment.paidOn,
  };
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly financeAccessService: FinanceAccessService,
    private readonly getInvoiceUseCase: GetInvoiceUseCase,
    private readonly getInvoicesForListUseCase: GetInvoicesForListUseCase,
    private readonly payInvoiceUseCase: PayInvoiceUseCase,
    private readonly undoInvoicePaymentUseCase: UndoInvoicePaymentUseCase,
  ) {}

  async findForList(userId: string, month: string, ownerIds?: string[], today?: string) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const details = await this.getInvoicesForListUseCase.execute({
      accessibleOwners,
      month,
      ownerIds,
      today: today ?? todayInSaoPaulo(),
    });

    return details.map((detail) => toDetailOutput(detail));
  }

  async findOne(userId: string, creditCardId: string, invoiceMonth: string, today?: string) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    return toDetailOutput(
      await this.getInvoiceUseCase.execute({
        accessibleOwners,
        creditCardId,
        invoiceMonth,
        today: today ?? todayInSaoPaulo(),
      }),
    );
  }

  async pay(
    userId: string,
    creditCardId: string,
    invoiceMonth: string,
    input: PayInvoiceApiInput,
    today?: string,
  ) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const resolvedToday = today ?? todayInSaoPaulo();

    return toPaymentOutput(
      await this.payInvoiceUseCase.execute({
        accessibleOwners,
        accountId: input.accountId,
        creditCardId,
        invoiceMonth,
        method: input.method,
        paidOn: input.paidOn ?? resolvedToday,
        today: resolvedToday,
      }),
    );
  }

  async undo(userId: string, creditCardId: string, invoiceMonth: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.undoInvoicePaymentUseCase.execute({ accessibleOwners, creditCardId, invoiceMonth });
  }
}
