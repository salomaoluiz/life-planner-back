import { Inject } from '@nestjs/common';

import {
  CategoryMembershipInput,
  CategoryMembershipSchema,
} from '@finance/application/dto/CategoryMembership';
import { IFinanceCategoryRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// FR 12/14: the creator left, was removed or is deleted: the family keeps its own copy of their ALL categories and records.
// Idempotent; returns how many categories were copied.
export class DetachCategoryCreatorFromFamilyUseCase implements UseCaseWithParams<
  CategoryMembershipInput,
  number
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
  ) {}

  async execute(params: CategoryMembershipInput): Promise<number> {
    const input = validate(CategoryMembershipSchema, params);

    return this.categoryRepository.detachFamilyScope({
      creatorId: input.userId,
      familyId: input.familyId,
    });
  }
}
