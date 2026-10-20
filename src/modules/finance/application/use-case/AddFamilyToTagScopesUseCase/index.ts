import { Inject } from '@nestjs/common';

import {
  CategoryMembershipInput,
  CategoryMembershipSchema,
} from '@finance/application/dto/CategoryMembership';
import { IFinanceTagRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';

// Spec 043 §4: the creator joined or created a family, so every ALL tag they created gets its scope. Idempotent.
export class AddFamilyToTagScopesUseCase implements UseCaseWithParams<
  CategoryMembershipInput,
  void
> {
  constructor(
    @Inject('IFinanceTagRepository')
    private readonly tagRepository: IFinanceTagRepository,
  ) {}

  async execute(params: CategoryMembershipInput): Promise<void> {
    const input = validate(CategoryMembershipSchema, params);

    await this.tagRepository.addScope({
      creatorId: input.userId,
      owner: { owner: OwnerType.FAMILY, ownerId: input.familyId },
    });
  }
}
