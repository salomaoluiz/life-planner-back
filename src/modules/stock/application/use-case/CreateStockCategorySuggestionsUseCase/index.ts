import { ConflictException, Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  CreateStockSuggestionsInput,
  CreateStockSuggestionsSchema,
} from '@stock/application/dto/StockCatalog';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import StockCategoryEntity from '@stock/domain/entity/StockCategoryEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { categorySuggestions, pickSuggestions } from '@stock/domain/service/StockDefaults';

// FR 23 + spec 125 FR 24: creates the chosen (default: all) editable suggestions, with their color and icon, for an
// owner with no categories (409 otherwise).
export class CreateStockCategorySuggestionsUseCase implements UseCaseWithParams<
  CreateStockSuggestionsInput,
  StockCategoryEntity[]
> {
  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: CreateStockSuggestionsInput): Promise<StockCategoryEntity[]> {
    const input = validate(CreateStockSuggestionsSchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    ensureCatalogWritable(input.accessibleOwners, target);

    if ((await this.catalogRepository.findCategories(target)).length > 0) {
      throw new ConflictException('This owner already has categories');
    }

    return this.catalogRepository.createCategories(
      pickSuggestions(categorySuggestions(input.language), input.keys).map(
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
