import { Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { UpdateMarketInput, UpdateMarketSchema } from '@stock/application/dto/Purchase';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import MarketEntity from '@stock/domain/entity/MarketEntity';
import { IMarketRepository } from '@stock/domain/repository';

export class UpdateMarketUseCase implements UseCaseWithParams<UpdateMarketInput, MarketEntity> {
  constructor(
    @Inject('IMarketRepository')
    private readonly marketRepository: IMarketRepository,
  ) {}

  async execute(params: UpdateMarketInput): Promise<MarketEntity> {
    const input = validate(UpdateMarketSchema, params);
    const market = await this.marketRepository.findById(input.id);

    if (!market) {
      throw new NotFoundException();
    }

    ensureCatalogWritable(input.accessibleOwners, market);

    return this.marketRepository.update({
      id: market.id,
      name: input.name,
      neighborhood: input.neighborhood,
      status: input.status,
    });
  }
}
