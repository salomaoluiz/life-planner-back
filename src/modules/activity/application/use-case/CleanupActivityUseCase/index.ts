import { Inject } from '@nestjs/common';

import { IActivityRepository } from '@activity/domain/repository/IActivityRepository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

const DAY_MS = 86_400_000;

// Spec 127 FR 13: entries older than the retention window (items cascade). Idempotent.
export class CleanupActivityUseCase implements UseCaseWithParams<
  { now?: Date; retentionDays: number },
  number
> {
  constructor(@Inject('IActivityRepository') private readonly repository: IActivityRepository) {}

  async execute(input: { now?: Date; retentionDays: number }): Promise<number> {
    const now = (input.now ?? new Date()).getTime();

    return this.repository.deleteOlderThan(new Date(now - input.retentionDays * DAY_MS));
  }
}
