import { Inject } from '@nestjs/common';

import { GetCategoriesInput, GetCategoriesSchema } from '@finance/application/dto/GetCategories';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { IFinanceCategoryRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// type, then name ascending (case-insensitive).
export class GetCategoriesUseCase implements UseCaseWithParams<
  GetCategoriesInput,
  CategoryEntity[]
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: GetCategoriesInput): Promise<CategoryEntity[]> {
    const input = validate(GetCategoriesSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    const categories = await this.categoryRepository.findCategories({ owners, type: input.type });

    return [...categories].sort(compareCategories);
  }
}

function compareCategories(a: CategoryEntity, b: CategoryEntity): number {
  return a.type.localeCompare(b.type) || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}
