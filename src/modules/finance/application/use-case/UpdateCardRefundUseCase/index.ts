import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  UpdateCardRefundInput,
  UpdateCardRefundSchema,
} from '@finance/application/dto/UpdateCardRefund';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { ResolveRefundLinkUseCase } from '@finance/application/use-case/ResolveRefundLinkUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { SystemCategoryKey } from '@finance/domain/enum';
import {
  IFinanceCardCreditRepository,
  IFinanceCreditCardRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { isInvoiceAssignable } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Edit of a refund: everything while its invoice has no payment record, only the description after (spec 032 FR 25).
export class UpdateCardRefundUseCase implements UseCaseWithParams<
  UpdateCardRefundInput,
  TransactionEntity
> {
  constructor(
    @Inject('IFinanceCardCreditRepository')
    private readonly cardCreditRepository: IFinanceCardCreditRepository,
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject(ResolveRefundLinkUseCase)
    private readonly resolveRefundLinkUseCase: ResolveRefundLinkUseCase,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: UpdateCardRefundInput): Promise<TransactionEntity> {
    const input = validate(UpdateCardRefundSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.creditCardId);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, card);

    const refund = await this.transactionRepository.findTransactionById(input.id);

    if (
      !refund ||
      refund.creditCardId !== card.id ||
      refund.category.systemKey !== SystemCategoryKey.CARD_REFUND
    ) {
      throw new NotFoundException();
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });
    const isPaid = data.payments.some((payment) => payment.referenceMonth === refund.invoiceMonth);
    const onlyDescription =
      input.date === undefined &&
      input.invoiceMonth === undefined &&
      input.refundedPlanId === undefined &&
      input.refundedTransactionId === undefined &&
      input.value === undefined;

    if (isPaid && !onlyDescription) {
      throw new UnprocessableEntityException('Invoice is paid');
    }
    if (
      input.invoiceMonth !== undefined &&
      input.invoiceMonth !== refund.invoiceMonth &&
      !isInvoiceAssignable(card, input.invoiceMonth, data.payments, input.today)
    ) {
      throw new UnprocessableEntityException('Invoice is paid or not open yet');
    }

    const transactionId =
      input.refundedTransactionId === undefined
        ? refund.refundedTransactionId
        : input.refundedTransactionId;
    const planId =
      input.refundedPlanId === undefined ? refund.refundedPlanId : input.refundedPlanId;
    const touchesLink =
      input.value !== undefined ||
      input.refundedPlanId !== undefined ||
      input.refundedTransactionId !== undefined;
    const link = touchesLink
      ? await this.resolveRefundLinkUseCase.execute({
          creditCardId: card.id,
          refundedPlanId: planId,
          refundedTransactionId: transactionId,
        })
      : {};

    return this.cardCreditRepository.updateRefund({
      date: input.date,
      description: input.description,
      id: refund.id,
      invoiceMonth: input.invoiceMonth,
      maxLinked: link.cap,
      refundedPlanId: input.refundedPlanId,
      refundedTransactionId: input.refundedTransactionId,
      value: input.value,
    });
  }
}
