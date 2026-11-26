import { Inject } from '@nestjs/common';

import { NotificationPreferences } from '@notification/domain/entity/NotificationPreferences';
import { INotificationPreferenceRepository } from '@notification/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface NotificationPreferencesOutput {
  // Families the user turned off (the API lists the active ones and marks these as disabled).
  disabledFamilyIds: string[];
  preferences: NotificationPreferences;
}

// Spec 124 FR 35: preferences have defaults and need no row until the first change.
export class GetNotificationPreferencesUseCase implements UseCaseWithParams<
  { userId: string },
  NotificationPreferencesOutput
> {
  constructor(
    @Inject('INotificationPreferenceRepository')
    private readonly repository: INotificationPreferenceRepository,
  ) {}

  async execute(input: { userId: string }): Promise<NotificationPreferencesOutput> {
    const [preferences, disabled] = await Promise.all([
      this.repository.find(input.userId),
      this.repository.findDisabledFamilyIds([input.userId]),
    ]);

    return { disabledFamilyIds: [...(disabled.get(input.userId) ?? [])], preferences };
  }
}
