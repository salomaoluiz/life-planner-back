import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { NotificationPreferencesOutput } from '@notification/application/use-case/GetNotificationPreferencesUseCase';
import {
  INotificationPreferenceRepository,
  PreferencePatch,
} from '@notification/domain/repository';
import { isValidTimeZone } from '@notification/domain/service/NotificationClock';
import {
  isMultipleOfTick,
  isSummaryInsideQuiet,
} from '@notification/domain/service/PreferenceRules';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { ValidationError } from '@shared/domain/error/ValidationError';

export interface UpdateNotificationPreferencesInput {
  families?: { enabled: boolean; familyId: string }[];
  // The active families the user belongs to (resolved by the API): anything else is a 404.
  memberFamilyIds: string[];
  patch: PreferencePatch;
  tickMinutes: number;
  userId: string;
}

export const SUMMARY_IN_QUIET_MESSAGE = 'Escolha um horário fora do silêncio';

// Spec 124 section 7 `PATCH /notifications/preferences`: any subset; 422 for a summary time inside quiet hours (FR 13).
export class UpdateNotificationPreferencesUseCase implements UseCaseWithParams<
  UpdateNotificationPreferencesInput,
  NotificationPreferencesOutput
> {
  constructor(
    @Inject('INotificationPreferenceRepository')
    private readonly repository: INotificationPreferenceRepository,
  ) {}

  async execute(input: UpdateNotificationPreferencesInput): Promise<NotificationPreferencesOutput> {
    const { families, memberFamilyIds, patch, tickMinutes, userId } = input;

    if (patch.timeZone !== undefined && !isValidTimeZone(patch.timeZone)) {
      throw new ValidationError([
        { code: 'invalid_time_zone', field: 'timeZone', message: 'Unknown time zone' },
      ]);
    }

    if (patch.summaryMinute !== undefined && !isMultipleOfTick(patch.summaryMinute, tickMinutes)) {
      throw new ValidationError([
        {
          code: 'invalid_summary_time',
          field: 'summaryTime',
          message: `Must be a multiple of ${tickMinutes} minutes`,
        },
      ]);
    }

    if (families?.some((family) => !memberFamilyIds.includes(family.familyId))) {
      throw new NotFoundException();
    }

    const current = await this.repository.find(userId);
    const merged = { ...current, ...definedOnly(patch) };

    if (
      isSummaryInsideQuiet(merged.summaryMinute, merged.quietStartMinute, merged.quietEndMinute)
    ) {
      throw new UnprocessableEntityException(SUMMARY_IN_QUIET_MESSAGE);
    }

    const saved =
      Object.keys(definedOnly(patch)).length > 0
        ? await this.repository.save(userId, definedOnly(patch))
        : current;

    for (const family of families ?? []) {
      await this.repository.setFamilyEnabled(userId, family.familyId, family.enabled);
    }

    const disabled = await this.repository.findDisabledFamilyIds([userId]);

    return { disabledFamilyIds: [...(disabled.get(userId) ?? [])], preferences: saved };
  }
}

function definedOnly(patch: PreferencePatch): PreferencePatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as PreferencePatch;
}
