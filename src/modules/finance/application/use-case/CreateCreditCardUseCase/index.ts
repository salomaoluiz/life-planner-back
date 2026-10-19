import { ForbiddenException, Inject } from '@nestjs/common';

import {
  CreateCreditCardInput,
  CreateCreditCardSchema,
} from '@finance/application/dto/CreateCreditCard';
import { assertPaymentAccount } from '@finance/application/service/PaymentAccount';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  IFinanceAccountRepository,
  IFinanceCreditCardRepository,
} from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class CreateCreditCardUseCase implements UseCaseWithParams<
  CreateCreditCardInput,
  CreditCardEntity
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
  ) {}

  async execute(params: CreateCreditCardInput): Promise<CreditCardEntity> {
    const input = validate(CreateCreditCardSchema, params);

    if (!hasOwnerAccess(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId })) {
      throw new ForbiddenException('Owner not accessible');
    }

    if (input.paymentAccountId !== undefined) {
      await assertPaymentAccount(
        this.accountRepository,
        input.accessibleOwners,
        input.paymentAccountId,
      );
    }

    return this.creditCardRepository.createCreditCard({
      brand: input.brand,
      closingDay: input.closingDay,
      color: input.color,
      dueDay: input.dueDay,
      lastDigits: input.lastDigits,
      limit: input.limit,
      owner: input.owner,
      ownerId: input.ownerId,
      paymentAccountId: input.paymentAccountId,
      paymentDay: input.paymentDay,
      status: input.status,
      title: input.title,
    });
  }
}
