import { Inject } from '@nestjs/common';

import {
  INotificationPreferenceRepository,
  INotificationRepository,
} from '@notification/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface RemoveFamilyNotificationsInput {
  familyId: string;
  // Absent WHEN the family itself was deleted: nobody keeps its notices.
  userId?: string;
}

// Spec 124 section 4: the user lost access to the family (or the family was deleted): their family switch and the notice
// items of that family leave the center. Idempotent; the same hook points as the 094 account favorites.
export class RemoveFamilyNotificationsUseCase implements UseCaseWithParams<
  RemoveFamilyNotificationsInput,
  void
> {
  constructor(
    @Inject('INotificationRepository') private readonly notices: INotificationRepository,
    @Inject('INotificationPreferenceRepository')
    private readonly preferences: INotificationPreferenceRepository,
  ) {}

  async execute(input: RemoveFamilyNotificationsInput): Promise<void> {
    if (input.userId === undefined) {
      await this.notices.removeFamilyItemsForAll(input.familyId);

      return;
    }

    await this.notices.removeFamilyItems(input.userId, input.familyId);
    await this.preferences.removeFamily(input.userId, input.familyId);
  }
}
