import { Inject } from '@nestjs/common';

import {
  GetCategoryIconsInput,
  GetCategoryIconsSchema,
} from '@finance/application/dto/GetCategoryIcons';
import {
  CATEGORY_ICON_GROUPS,
  CategoryIconEntity,
} from '@finance/domain/entity/CategoryIconEntity';
import { IFinanceCategoryIconRepository } from '@finance/domain/repository';
import { toSearchTerms } from '@finance/domain/service/IconSearchQuery';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

const MIN_FUZZY_LENGTH = 3;

function groupIndex(group: string): number {
  const index = (CATEGORY_ICON_GROUPS as readonly string[]).indexOf(group);

  return index === -1 ? CATEGORY_ICON_GROUPS.length : index;
}

// Spec 058 FR 12-13: no query → the grouped catalog; a query → full-text prefix search, then a trigram fallback.
export class GetCategoryIconsUseCase implements UseCaseWithParams<
  GetCategoryIconsInput,
  CategoryIconEntity[]
> {
  constructor(
    @Inject('IFinanceCategoryIconRepository')
    private readonly iconRepository: IFinanceCategoryIconRepository,
  ) {}

  async execute(params: GetCategoryIconsInput): Promise<CategoryIconEntity[]> {
    const input = validate(GetCategoryIconsSchema, params);
    const terms = toSearchTerms(input.q ?? '');

    if (terms.length === 0) {
      const all = await this.iconRepository.listAll();

      return [...all].sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || a.sort - b.sort);
    }

    const found = await this.iconRepository.search({ limit: input.limit, terms });
    const text = terms.join(' ');

    if (found.length > 0 || text.length < MIN_FUZZY_LENGTH) {
      return found;
    }

    return this.iconRepository.searchSimilar({ limit: input.limit, text });
  }
}
