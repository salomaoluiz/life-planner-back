import { Inject } from '@nestjs/common';

import { IActivityRepository } from '@activity/domain/repository/IActivityRepository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 127 FR 14, 15: account deletion drops the USER entries (the FK nulls the actor of the entries done in family
// data); family deletion drops the FAMILY entries.
export class PurgeActivityByOwnerUseCase implements UseCaseWithParams<
  { owner: OwnerType; ownerId: string },
  number
> {
  constructor(@Inject('IActivityRepository') private readonly repository: IActivityRepository) {}

  async execute(input: { owner: OwnerType; ownerId: string }): Promise<number> {
    return this.repository.deleteByOwner(input.owner, input.ownerId);
  }
}
