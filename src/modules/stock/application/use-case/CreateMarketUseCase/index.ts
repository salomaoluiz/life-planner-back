import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { CreateMarketInput, CreateMarketSchema } from '@stock/application/dto/Purchase';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import MarketEntity from '@stock/domain/entity/MarketEntity';
import { IMarketRepository } from '@stock/domain/repository';

// Spec 120 FR 9: a duplicate active name is refused by the unique index (409).
export class CreateMarketUseCase implements UseCaseWithParams<CreateMarketInput, MarketEntity> {
  constructor(
    @Inject('IMarketRepository')
    private readonly marketRepository: IMarketRepository,
  ) {}

  async execute(params: CreateMarketInput): Promise<MarketEntity> {
    const input = validate(CreateMarketSchema, params);

    ensureCatalogWritable(input.accessibleOwners, { owner: input.owner, ownerId: input.ownerId });

    return this.marketRepository.create({
      name: input.name,
      neighborhood: input.neighborhood,
      owner: input.owner,
      ownerId: input.ownerId,
    });
  }
}
