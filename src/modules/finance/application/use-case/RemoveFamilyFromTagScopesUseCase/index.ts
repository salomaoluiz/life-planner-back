import { Inject } from '@nestjs/common';

import { FamilyScopeInput, FamilyScopeSchema } from '@finance/application/dto/CategoryMembership';
import { IFinanceTagRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';

// Spec 043 §4: the family was deleted, so it leaves the scopes of every ALL tag. Idempotent.
export class RemoveFamilyFromTagScopesUseCase implements UseCaseWithParams<FamilyScopeInput, void> {
  constructor(
    @Inject('IFinanceTagRepository')
    private readonly tagRepository: IFinanceTagRepository,
  ) {}

  async execute(params: FamilyScopeInput): Promise<void> {
    const input = validate(FamilyScopeSchema, params);

    await this.tagRepository.removeScope({ owner: OwnerType.FAMILY, ownerId: input.familyId });
  }
}
