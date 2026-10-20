import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';

import {
  UpdateCreditCardInput,
  UpdateCreditCardSchema,
} from '@finance/application/dto/UpdateCreditCard';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { assertPaymentAccount } from '@finance/application/service/PaymentAccount';
import { EndRecurrencesBySourceUseCase } from '@finance/application/use-case/EndRecurrencesBySourceUseCase';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import {
  IFinanceAccountRepository,
  IFinanceCreditCardRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class UpdateCreditCardUseCase implements UseCaseWithParams<
  UpdateCreditCardInput,
  CreditCardEntity
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject(EndRecurrencesBySourceUseCase)
    private readonly endRecurrencesBySourceUseCase: EndRecurrencesBySourceUseCase,
  ) {}

  async execute(params: UpdateCreditCardInput): Promise<CreditCardEntity> {
    const input = validate(UpdateCreditCardSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.id);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, card);

    // Unlike accounts, the owner can change: the new owner must also be accessible to the caller.
    if (
      input.owner !== undefined &&
      input.ownerId !== undefined &&
      !hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })
    ) {
      throw new ForbiddenException('Owner not accessible');
    }

    if (input.owner !== undefined && input.ownerId !== undefined) {
      ensureOwnerWritable(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId });
    }

    if (input.paymentAccountId) {
      await assertPaymentAccount(
        this.accountRepository,
        input.accessibleOwners,
        input.paymentAccountId,
        card.currency,
      );
    }

    const updated = await this.creditCardRepository.updateCreditCard({
      brand: input.brand,
      closingDay: input.closingDay,
      color: input.color,
      dueDay: input.dueDay,
      id: input.id,
      lastDigits: input.lastDigits,
      limit: input.limit,
      owner: input.owner,
      ownerId: input.ownerId,
      paymentAccountId: input.paymentAccountId,
      paymentDay: input.paymentDay,
      status: input.status,
      title: input.title,
    });

    // Archiving ends its recurring series (spec 034 FR 34); reactivating does not restart them.
    if (input.status === AccountStatus.ARCHIVED && card.status !== AccountStatus.ARCHIVED) {
      await this.endRecurrencesBySourceUseCase.execute({
        accessibleOwners: input.accessibleOwners,
        creditCardId: card.id,
      });
    }

    return updated;
  }
}
