import { Inject, NotFoundException } from '@nestjs/common';

import { GetInvoiceInput, GetInvoiceSchema } from '@finance/application/dto/GetInvoice';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import {
  IFinanceCreditCardRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { buildInvoiceFor, Invoice } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface InvoiceDetail {
  card: CreditCardEntity;
  invoice: Invoice;
  purchases: TransactionEntity[];
}

export class GetInvoiceUseCase implements UseCaseWithParams<GetInvoiceInput, InvoiceDetail> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: GetInvoiceInput): Promise<InvoiceDetail> {
    const input = validate(GetInvoiceSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.creditCardId);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    const [[data], purchases] = await Promise.all([
      this.computeCardInvoicesUseCase.execute({ cards: [card], today: input.today }),
      this.transactionRepository.findCardPurchases([
        { creditCardId: card.id, invoiceMonth: input.invoiceMonth },
      ]),
    ]);

    return {
      card,
      invoice: buildInvoiceFor(card, input.invoiceMonth, data.totals, data.payments, input.today),
      purchases,
    };
  }
}
