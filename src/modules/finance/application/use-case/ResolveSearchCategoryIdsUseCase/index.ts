import { Inject } from '@nestjs/common';
import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';
import { IFinanceCategoryRepository } from '@finance/domain/repository';
import { collectDescendants } from '@finance/domain/service/CategoryTree';
import { normalizeText } from '@finance/domain/service/TextMatch';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

const ResolveSearchCategoryIdsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  q: z.string(),
});

export type ResolveSearchCategoryIdsInput = z.input<typeof ResolveSearchCategoryIdsSchema>;

// Spec 059 FR 14: the search matches a row by the name of its category OR of any ancestor, so the ids are the
// categories whose name contains the query plus all their descendants. One read, no query per row.
export class ResolveSearchCategoryIdsUseCase implements UseCaseWithParams<
  ResolveSearchCategoryIdsInput,
  string[]
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: ResolveSearchCategoryIdsInput): Promise<string[]> {
    const input = validate(ResolveSearchCategoryIdsSchema, params);
    const needle = normalizeText(input.q.trim());

    if (needle === '') {
      return [];
    }

    const categories = await this.categoryRepository.findCategories({
      owners: input.accessibleOwners,
    });
    const ids = new Set<string>();

    for (const category of categories) {
      if (normalizeText(category.name).includes(needle)) {
        ids.add(category.id);

        for (const child of collectDescendants(categories, category.id)) {
          ids.add(child.id);
        }
      }
    }

    return [...ids];
  }
}
