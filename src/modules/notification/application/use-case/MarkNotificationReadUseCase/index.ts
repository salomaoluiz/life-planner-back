import { Inject, NotFoundException } from '@nestjs/common';

import { INotificationRepository } from '@notification/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

// Spec 124 FR 19: opening a notice marks it read; a notice of another user is a 404.
export class MarkNotificationReadUseCase implements UseCaseWithParams<
  { id: string; now?: Date; userId: string },
  void
> {
  constructor(
    @Inject('INotificationRepository') private readonly repository: INotificationRepository,
  ) {}

  async execute(input: { id: string; now?: Date; userId: string }): Promise<void> {
    const found = await this.repository.markRead(input.userId, input.id, input.now ?? new Date());

    if (!found) {
      throw new NotFoundException();
    }
  }
}
