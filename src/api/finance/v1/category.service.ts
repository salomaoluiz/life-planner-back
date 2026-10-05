import { Injectable } from '@nestjs/common';

import {
  CategoryOutput,
  CreateCategoryApiInput,
  UpdateCategoryApiInput,
} from '@api/finance/v1/dto/category.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { CreateCategoryUseCase } from '@finance/application/use-case/CreateCategoryUseCase';
import { DeleteCategoryUseCase } from '@finance/application/use-case/DeleteCategoryUseCase';
import { GetCategoriesUseCase } from '@finance/application/use-case/GetCategoriesUseCase';
import { UpdateCategoryUseCase } from '@finance/application/use-case/UpdateCategoryUseCase';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { TransactionType } from '@finance/domain/enum';

function toCategoryOutput(category: CategoryEntity): CategoryOutput {
  return {
    createdAt: category.createdAt.toISOString(),
    depthLevel: category.depthLevel,
    icon: category.icon,
    iconColor: category.iconColor,
    id: category.id,
    name: category.name,
    owner: category.owner,
    ownerId: category.ownerId,
    parentId: category.parentId ?? null,
    type: category.type,
    updatedAt: category.updatedAt.toISOString(),
  };
}

@Injectable()
export class CategoryService {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getCategoriesUseCase: GetCategoriesUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
  ) {}

  async create(userId: string, input: CreateCategoryApiInput): Promise<CategoryOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const category = await this.createCategoryUseCase.execute({ ...input, accessibleOwners });

    return toCategoryOutput(category);
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteCategoryUseCase.execute({ accessibleOwners, id });
  }

  async findAll(
    userId: string,
    ownerIds?: string[],
    type?: TransactionType,
  ): Promise<CategoryOutput[]> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const categories = await this.getCategoriesUseCase.execute({
      accessibleOwners,
      ownerIds,
      type,
    });

    return categories.map((category) => toCategoryOutput(category));
  }

  async update(
    userId: string,
    id: string,
    input: UpdateCategoryApiInput,
  ): Promise<CategoryOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const category = await this.updateCategoryUseCase.execute({ ...input, accessibleOwners, id });

    return toCategoryOutput(category);
  }
}
