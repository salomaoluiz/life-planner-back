import {
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { DeleteCategoryInput, DeleteCategorySchema } from '@finance/application/dto/DeleteCategory';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { isVisibleTo } from '@finance/domain/entity/CategoryScope';
import { isSystemCategoryId } from '@finance/domain/entity/SystemCategory';
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

    if (isSystemCategoryId(input.id)) {
      throw new UnprocessableEntityException('System categories cannot be changed');
    }

    const category = await this.categoryRepository.findCategoryById(input.id);

    if (!category || !isVisibleTo(category, input.accessibleOwners)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, category);

    // Deleting a category also deletes its subtree (FK cascade): refuse if ANY category in it is used, in ANY scope.
    const scopeCategories = await this.categoryRepository.findCategories({
      owners: category.scopes,
    });
    const subtreeIds = [
      category.id,
      ...collectDescendants(scopeCategories, category.id).map((child) => child.id),
    ];

    if ((await this.transactionRepository.countByCategoryIds(subtreeIds)) > 0) {
      throw new ConflictException('Category has transactions');
    }

    await this.categoryRepository.deleteCategory(input.id);
  }
}
