import { Inject, NotFoundException } from '@nestjs/common';

import { DeleteCategoryInput, DeleteCategorySchema } from '@finance/application/dto/DeleteCategory';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceCategoryRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class DeleteCategoryUseCase implements UseCaseWithParams<DeleteCategoryInput, void> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: DeleteCategoryInput): Promise<void> {
    const input = validate(DeleteCategorySchema, params);

    const category = await this.categoryRepository.findCategoryById(input.id);

    if (!category || !hasOwnerAccess(input.accessibleOwners, category)) {
      throw new NotFoundException();
    }

    await this.categoryRepository.deleteCategory(input.id);
  }
}
