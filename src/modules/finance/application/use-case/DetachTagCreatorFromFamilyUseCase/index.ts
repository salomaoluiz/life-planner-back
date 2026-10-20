import { Inject } from '@nestjs/common';

import {
  CategoryMembershipInput,
  CategoryMembershipSchema,
} from '@finance/application/dto/CategoryMembership';
import { IFinanceTagRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 043 §4: the creator left, was removed or is deleted: the family keeps its own copy of their ALL tags and links.
// Idempotent; returns how many tags were copied.
export class DetachTagCreatorFromFamilyUseCase implements UseCaseWithParams<
  CategoryMembershipInput,
  number
> {
  constructor(
    @Inject('IFinanceTagRepository')
    private readonly tagRepository: IFinanceTagRepository,
  ) {}

  async execute(params: CategoryMembershipInput): Promise<number> {
    const input = validate(CategoryMembershipSchema, params);

    return this.tagRepository.detachFamilyScope({
      creatorId: input.userId,
      familyId: input.familyId,
    });
  }
}
