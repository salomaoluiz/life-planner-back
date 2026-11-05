import { Inject } from '@nestjs/common';

import {
  FamilyAccountFavoritesInput,
  FamilyAccountFavoritesSchema,
} from '@finance/application/dto/FamilyAccountFavorites';
import { IFinanceAccountFavoriteRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 094 FR 6: the user lost access to the family accounts (or the family was deleted, no user): the favorites that point to them go away. Idempotent.
export class RemoveFamilyAccountFavoritesUseCase implements UseCaseWithParams<
  FamilyAccountFavoritesInput,
  void
> {
  constructor(
    @Inject('IFinanceAccountFavoriteRepository')
    private readonly favoriteRepository: IFinanceAccountFavoriteRepository,
  ) {}

  async execute(params: FamilyAccountFavoritesInput): Promise<void> {
    const input = validate(FamilyAccountFavoritesSchema, params);

    await this.favoriteRepository.clearByFamilyForUsers({
      familyId: input.familyId,
      userIds: input.userId === undefined ? undefined : [input.userId],
    });
  }
}
