import { Inject, NotFoundException } from '@nestjs/common';

import { NotificationDevice } from '@notification/domain/entity/NotificationDevice';
import { INotificationDeviceRepository } from '@notification/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface UpdateNotificationDeviceInput {
  enabled?: boolean;
  id: string;
  name?: string;
  userId: string;
}

// Spec 124 FR 24: rename or turn a device off; a device of another user is a 404.
export class UpdateNotificationDeviceUseCase implements UseCaseWithParams<
  UpdateNotificationDeviceInput,
  NotificationDevice
> {
  constructor(
    @Inject('INotificationDeviceRepository')
    private readonly repository: INotificationDeviceRepository,
  ) {}

  async execute(input: UpdateNotificationDeviceInput): Promise<NotificationDevice> {
    const device = await this.repository.findById(input.id);

    if (!device || device.userId !== input.userId) {
      throw new NotFoundException();
    }

    return this.repository.update(input.id, { enabled: input.enabled, name: input.name });
  }
}
