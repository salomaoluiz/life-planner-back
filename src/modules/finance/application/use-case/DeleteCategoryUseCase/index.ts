import { ConflictException, Inject, NotFoundException } from '@nestjs/common';

import { DeleteCategoryInput, DeleteCategorySchema } from '@finance/application/dto/DeleteCategory';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  IFinanceCategoryRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { collectDescendants } from '@finance/domain/service/CategoryTree';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class DeleteCategoryUseCase implements UseCaseWithParams<DeleteCategoryInput, void> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: DeleteCategoryInput): Promise<void> {
    const input = validate(DeleteCategorySchema, params);

    const category = await this.categoryRepository.findCategoryById(input.id);

    if (!category || !hasOwnerAccess(input.accessibleOwners, category)) {
      throw new NotFoundException();
    }

    // Deleting a category also deletes its subtree (FK cascade): refuse if ANY category in it is used.
    const sameOwnerCategories = await this.categoryRepository.findCategories({
      owners: [{ owner: category.owner, ownerId: category.ownerId }],
    });
    const subtreeIds = [
      category.id,
      ...collectDescendants(sameOwnerCategories, category.id).map((child) => child.id),
    ];

    if ((await this.transactionRepository.countByCategoryIds(subtreeIds)) > 0) {
      throw new ConflictException('Category has transactions');
    }

    await this.categoryRepository.deleteCategory(input.id);
  }
}
