import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetMarketsInput, GetMarketsSchema } from '@stock/application/dto/Purchase';
import MarketEntity from '@stock/domain/entity/MarketEntity';
import { narrowOwners } from '@stock/domain/entity/OwnerAccess';
import { IMarketRepository } from '@stock/domain/repository';

// Spec 120 FR 9: the markets of the readable owners (active ones unless asked).
export class GetMarketsUseCase implements UseCaseWithParams<GetMarketsInput, MarketEntity[]> {
  constructor(
    @Inject('IMarketRepository')
    private readonly marketRepository: IMarketRepository,
  ) {}

  async execute(params: GetMarketsInput): Promise<MarketEntity[]> {
    const input = validate(GetMarketsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerId);

    return owners.length === 0
      ? []
      : this.marketRepository.findByOwners(owners, input.includeArchived);
  }
}
