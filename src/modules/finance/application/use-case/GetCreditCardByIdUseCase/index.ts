import { Inject, NotFoundException } from '@nestjs/common';

import {
  GetCreditCardByIdInput,
  GetCreditCardByIdSchema,
} from '@finance/application/dto/GetCreditCardById';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceCreditCardRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class GetCreditCardByIdUseCase implements UseCaseWithParams<
  GetCreditCardByIdInput,
  CreditCardEntity
> {
  constructor(
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
  ) {}

  async execute(params: GetCreditCardByIdInput): Promise<CreditCardEntity> {
    const input = validate(GetCreditCardByIdSchema, params);

    const card = await this.creditCardRepository.findCreditCardById(input.id);

    if (!card || !hasOwnerAccess(input.accessibleOwners, card)) {
      throw new NotFoundException();
    }

    return card;
  }
}
