import { ConflictException, Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  CreateStockSuggestionsInput,
  CreateStockSuggestionsSchema,
} from '@stock/application/dto/StockCatalog';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { locationSuggestions, pickSuggestions } from '@stock/domain/service/StockDefaults';

export class CreateStockLocationSuggestionsUseCase implements UseCaseWithParams<
  CreateStockSuggestionsInput,
  StockLocationEntity[]
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: CreateStockSuggestionsInput): Promise<StockLocationEntity[]> {
    const input = validate(CreateStockSuggestionsSchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    ensureCatalogWritable(input.accessibleOwners, target);

    if ((await this.catalogRepository.findLocations(target)).length > 0) {
      throw new ConflictException('This owner already has locations');
    }

    return this.catalogRepository.createLocations(
      pickSuggestions(locationSuggestions(input.language), input.keys).map(
        ({ color, icon, name }) => ({
          color,
          icon,
          name,
          owner: input.owner,
          ownerId: input.ownerId,
        }),
      ),
    );
  }
}
