import { Inject } from '@nestjs/common';
import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';
import { IFinanceCategoryRepository } from '@finance/domain/repository';
import { collectDescendants } from '@finance/domain/service/CategoryTree';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

const ExpandCategoryIdsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  categoryIds: z.array(z.string()),
});

export type ExpandCategoryIdsInput = z.input<typeof ExpandCategoryIdsSchema>;

// Spec 045 FR 1: choosing a category includes all its subcategories. Ids that are not found are kept
// (they match nothing), so an invisible id never errors.
export class ExpandCategoryIdsUseCase implements UseCaseWithParams<
  ExpandCategoryIdsInput,
  string[]
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: ExpandCategoryIdsInput): Promise<string[]> {
    const input = validate(ExpandCategoryIdsSchema, params);

    if (input.categoryIds.length === 0) {
      return [];
    }

    const categories = await this.categoryRepository.findCategories({
      owners: input.accessibleOwners,
    });
    const ids = new Set(input.categoryIds);

    for (const id of input.categoryIds) {
      for (const child of collectDescendants(categories, id)) {
        ids.add(child.id);
      }
    }

    return [...ids];
  }
}
