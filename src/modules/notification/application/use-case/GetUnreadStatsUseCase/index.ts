import { Inject } from '@nestjs/common';

import { UnreadStats } from '@notification/domain/entity/NotificationEntity';
import { INotificationRepository } from '@notification/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

// Spec 124 FR 21: the bell count and the numbers of its ETag, one indexed query.
export class GetUnreadStatsUseCase implements UseCaseWithParams<{ userId: string }, UnreadStats> {
  constructor(
    @Inject('INotificationRepository') private readonly repository: INotificationRepository,
  ) {}

  async execute(input: { userId: string }): Promise<UnreadStats> {
    return this.repository.getUnreadStats(input.userId);
  }
}
