import { Inject } from '@nestjs/common';
import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { IFinanceCategoryRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

const LoadFilterCategoriesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  filter: z
    .object({ categoryIds: z.array(z.string()).optional(), q: z.string().optional() })
    .optional(),
});

export type LoadFilterCategoriesInput = z.input<typeof LoadFilterCategoriesSchema>;

// Spec 083: the one category read of a request. Only a filter on category ids or text needs the tree
// (expansion, search by name); callers pass the result down as `preloaded.categories`.
export class LoadFilterCategoriesUseCase implements UseCaseWithParams<
  LoadFilterCategoriesInput,
  CategoryEntity[] | undefined
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: LoadFilterCategoriesInput): Promise<CategoryEntity[] | undefined> {
    const input = validate(LoadFilterCategoriesSchema, params);

    if (!input.filter?.categoryIds?.length && !input.filter?.q) {
      return undefined;
    }

    return this.categoryRepository.findCategories({ owners: input.accessibleOwners });
  }
}
