import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  CreateCardRefundInput,
  CreateCardRefundSchema,
} from '@finance/application/dto/CreateCardRefund';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { ResolveRefundLinkUseCase } from '@finance/application/use-case/ResolveRefundLinkUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { AccountStatus, SystemCategoryKey } from '@finance/domain/enum';
import {
  IFinanceCardCreditRepository,
  IFinanceCreditCardRepository,
} from '@finance/domain/repository';
import { isInvoiceAssignable } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// A card refund: an INCOME row on an open or closed unpaid invoice, optionally linked to a purchase or plan (spec 032 FR 21-28).
export class CreateCardRefundUseCase implements UseCaseWithParams<
  CreateCardRefundInput,
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
  ) {}

  async execute(params: CreateCardRefundInput): Promise<TransactionEntity> {
    const input = validate(CreateCardRefundSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.creditCardId);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }
    if (card.status === AccountStatus.ARCHIVED) {
      throw new UnprocessableEntityException('Credit card is archived');
    }

    const [data] = await this.computeCardInvoicesUseCase.execute({
      cards: [card],
      today: input.today,
    });

    if (!isInvoiceAssignable(card, input.invoiceMonth, data.payments, input.today)) {
      throw new UnprocessableEntityException('Invoice is paid or not open yet');
    }

    const link = await this.resolveRefundLinkUseCase.execute({
      creditCardId: card.id,
      refundedPlanId: input.refundedPlanId,
      refundedTransactionId: input.refundedTransactionId,
    });

    return this.cardCreditRepository.createRefund({
      categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_REFUND],
      creditCardId: card.id,
      date: input.date,
      description: input.description,
      invoiceMonth: input.invoiceMonth,
      maxLinked: link.cap,
      owner: card.owner,
      ownerId: card.ownerId,
      refundedPlanId: input.refundedPlanId,
      refundedTransactionId: input.refundedTransactionId,
      value: input.value,
    });
  }
}
