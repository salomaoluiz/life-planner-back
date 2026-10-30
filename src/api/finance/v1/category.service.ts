import { Injectable } from '@nestjs/common';

import { todayInSaoPaulo } from '@api/finance/v1/credit-card-today';
import {
  CategoryOutput,
  CreateCategoryApiInput,
  UpdateCategoryApiInput,
  UpdateCategoryAppearanceApiInput,
} from '@api/finance/v1/dto/category.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { CreateCategoryUseCase } from '@finance/application/use-case/CreateCategoryUseCase';
import { DeleteCategoryUseCase } from '@finance/application/use-case/DeleteCategoryUseCase';
import { GetCategoriesUseCase } from '@finance/application/use-case/GetCategoriesUseCase';
import { UpdateCategorySubtreeAppearanceUseCase } from '@finance/application/use-case/UpdateCategorySubtreeAppearanceUseCase';
import { UpdateCategoryUseCase } from '@finance/application/use-case/UpdateCategoryUseCase';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { categoryScopeKind, visibleScopes } from '@finance/domain/entity/CategoryScope';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Personal first, so the owner of an ALL category reads as the caller's own scope when they have it.
function toCategoryOutput(
  category: CategoryEntity,
  accessibleOwners: OwnerAccess[],
): CategoryOutput {
  const scopes = visibleScopesOf(category, accessibleOwners);
  const [firstScope] = scopes;
  // An ALL category never exposes a creator's Personal scope the caller cannot reach.
  const owner = category.allScopes && firstScope ? firstScope : category;

  return {
    createdAt: category.createdAt.toISOString(),
    depthLevel: category.depthLevel,
    icon: category.icon,
    iconColor: category.iconColor,
    id: category.id,
    name: category.name,
    owner: owner.owner,
    ownerId: owner.ownerId,
    parentId: category.parentId ?? null,
    scope: categoryScopeKind(category),
    scopes,
    status: category.status,
    type: category.type,
    updatedAt: category.updatedAt.toISOString(),
  };
}
function visibleScopesOf(category: CategoryEntity, accessibleOwners: OwnerAccess[]) {
  return [...visibleScopes(category, accessibleOwners)].sort(
    (a, b) => Number(b.owner === OwnerType.USER) - Number(a.owner === OwnerType.USER),
  );
}

@Injectable()
export class CategoryService {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getCategoriesUseCase: GetCategoriesUseCase,
    private readonly updateCategorySubtreeAppearanceUseCase: UpdateCategorySubtreeAppearanceUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
  ) {}

  async create(userId: string, input: CreateCategoryApiInput): Promise<CategoryOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const category = await this.createCategoryUseCase.execute({
      ...input,
      accessibleOwners,
      callerId: userId,
    });

    return toCategoryOutput(category, accessibleOwners);
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

    return categories.map((category) => toCategoryOutput(category, accessibleOwners));
  }

  async update(userId: string, id: string, input: UpdateCategoryApiInput): Promise<CategoryOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const category = await this.updateCategoryUseCase.execute({
      ...input,
      accessibleOwners,
      callerId: userId,
      id,
      today: todayInSaoPaulo(),
    });

    return toCategoryOutput(category, accessibleOwners);
  }

  async updateAppearance(
    userId: string,
    id: string,
    input: UpdateCategoryAppearanceApiInput,
  ): Promise<CategoryOutput[]> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const categories = await this.updateCategorySubtreeAppearanceUseCase.execute({
      ...input,
      accessibleOwners,
      callerId: userId,
      id,
      today: todayInSaoPaulo(),
    });

    return categories.map((category) => toCategoryOutput(category, accessibleOwners));
  }
}
