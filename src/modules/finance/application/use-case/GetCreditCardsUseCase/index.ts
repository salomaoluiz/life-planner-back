import { Inject } from '@nestjs/common';

import { GetCreditCardsInput, GetCreditCardsSchema } from '@finance/application/dto/GetCreditCards';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { IFinanceCreditCardRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// ACTIVE first, then title ascending, case-insensitive.
export class GetCreditCardsUseCase implements UseCaseWithParams<
  GetCreditCardsInput,
  CreditCardEntity[]
> {
  constructor(
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
  ) {}

  async execute(params: GetCreditCardsInput): Promise<CreditCardEntity[]> {
    const input = validate(GetCreditCardsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    const cards = await this.creditCardRepository.findCreditCards(owners, input.status);

    return [...cards].sort(compareCards);
  }
}

function compareCards(a: CreditCardEntity, b: CreditCardEntity): number {
  return (
    statusRank(a) - statusRank(b) || a.title.toLowerCase().localeCompare(b.title.toLowerCase())
  );
}
function statusRank(card: CreditCardEntity): number {
  return card.status === AccountStatus.ACTIVE ? 0 : 1;
}
