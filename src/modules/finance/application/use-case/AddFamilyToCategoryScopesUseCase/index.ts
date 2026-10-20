import { Inject } from '@nestjs/common';

import {
  CategoryMembershipInput,
  CategoryMembershipSchema,
} from '@finance/application/dto/CategoryMembership';
import { IFinanceCategoryRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';

// FR 11: the creator joined or created a family, so every ALL category they created gets its scope. Idempotent.
export class AddFamilyToCategoryScopesUseCase implements UseCaseWithParams<
  CategoryMembershipInput,
  void
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: CategoryMembershipInput): Promise<void> {
    const input = validate(CategoryMembershipSchema, params);

    await this.categoryRepository.addScope({
      creatorId: input.userId,
      owner: { owner: OwnerType.FAMILY, ownerId: input.familyId },
    });
  }
}
