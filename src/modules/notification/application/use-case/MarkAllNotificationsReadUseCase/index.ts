import { Inject } from '@nestjs/common';

import { INotificationRepository } from '@notification/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

// Spec 124 FR 19 / section 7: "Marcar todos como lidos", up to `before` (default now).
export class MarkAllNotificationsReadUseCase implements UseCaseWithParams<
  { before?: Date; now?: Date; userId: string },
  void
> {
  constructor(
    @Inject('INotificationRepository') private readonly repository: INotificationRepository,
  ) {}

  async execute(input: { before?: Date; now?: Date; userId: string }): Promise<void> {
    const now = input.now ?? new Date();

    await this.repository.markAllRead(input.userId, input.before ?? now, now);
  }
}
