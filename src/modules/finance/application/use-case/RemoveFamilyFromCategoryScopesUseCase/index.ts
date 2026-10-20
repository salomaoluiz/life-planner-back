import { Inject } from '@nestjs/common';

import { FamilyScopeInput, FamilyScopeSchema } from '@finance/application/dto/CategoryMembership';
import { IFinanceCategoryRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';

// FR 13: the family was deleted, so it leaves the scopes of every ALL category. Idempotent.
export class RemoveFamilyFromCategoryScopesUseCase implements UseCaseWithParams<
  FamilyScopeInput,
  void
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: FamilyScopeInput): Promise<void> {
    const input = validate(FamilyScopeSchema, params);

    await this.categoryRepository.removeScope({ owner: OwnerType.FAMILY, ownerId: input.familyId });
  }
}
