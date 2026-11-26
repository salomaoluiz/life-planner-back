import { Inject } from '@nestjs/common';

import { INotificationRepository } from '@notification/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 124 section 4 (account deletion, 024): the purge entry of the notification module. The tables also cascade from
// the user row; this step is explicit for clarity and tests. A USER owner is the account itself; a FAMILY owner is a
// family being deleted with it. Idempotent; returns how many notices were deleted.
export class DeleteNotificationsByUserUseCase implements UseCaseWithParams<
  { owner: OwnerType; ownerId: string },
  number
> {
  constructor(
    @Inject('INotificationRepository') private readonly notices: INotificationRepository,
  ) {}

  async execute(input: { owner: OwnerType; ownerId: string }): Promise<number> {
    if (input.owner === OwnerType.USER) {
      return this.notices.deleteByUser(input.ownerId);
    }

    await this.notices.removeFamilyItemsForAll(input.ownerId);

    return 0;
  }
}
