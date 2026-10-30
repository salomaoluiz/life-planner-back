import { Inject } from '@nestjs/common';

import { UpdateCategoryInput } from '@finance/application/dto/UpdateCategory';
import { UpdateCategoryUseCase } from '@finance/application/use-case/UpdateCategoryUseCase';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { CategoryAppearance, IFinanceCategoryRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export type UpdateCategorySubtreeAppearanceInput = {
  descendants: CategoryAppearance[];
} & Omit<UpdateCategoryInput, 'subtreeAppearance'>;

// Spec 058: the edited category and the icon / color of its descendants are written in ONE transaction. Returns the
// edited category followed by the descendants of the request, as they are stored now.
export class UpdateCategorySubtreeAppearanceUseCase implements UseCaseWithParams<
  UpdateCategorySubtreeAppearanceInput,
  CategoryEntity[]
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
  ) {}

  async execute(params: UpdateCategorySubtreeAppearanceInput): Promise<CategoryEntity[]> {
    const { descendants, ...rest } = params;
    const edited = await this.updateCategoryUseCase.execute({
      ...rest,
      subtreeAppearance: descendants,
    });
    const stored = await this.categoryRepository.findCategories({ owners: edited.scopes });
    const byId = new Map(stored.map((category) => [category.id, category]));

    return [
      edited,
      ...descendants.flatMap((item) => {
        const category = byId.get(item.id);

        return category ? [category] : [];
      }),
    ];
  }
}
