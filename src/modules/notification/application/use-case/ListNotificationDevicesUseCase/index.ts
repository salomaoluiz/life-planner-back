import { Inject } from '@nestjs/common';

import { NotificationDevice } from '@notification/domain/entity/NotificationDevice';
import { INotificationDeviceRepository } from '@notification/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class ListNotificationDevicesUseCase implements UseCaseWithParams<
  { userId: string },
  NotificationDevice[]
> {
  constructor(
    @Inject('INotificationDeviceRepository')
    private readonly repository: INotificationDeviceRepository,
  ) {}

  async execute(input: { userId: string }): Promise<NotificationDevice[]> {
    return this.repository.findByUser(input.userId);
  }
}
