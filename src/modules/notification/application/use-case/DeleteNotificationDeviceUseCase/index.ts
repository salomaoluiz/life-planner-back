import { Inject, NotFoundException } from '@nestjs/common';

import { INotificationDeviceRepository } from '@notification/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

// Spec 124 FR 22: logout (and "remove") deletes the device; a device of another user is a 404.
export class DeleteNotificationDeviceUseCase implements UseCaseWithParams<
  { id: string; userId: string },
  void
> {
  constructor(
    @Inject('INotificationDeviceRepository')
    private readonly repository: INotificationDeviceRepository,
  ) {}

  async execute(input: { id: string; userId: string }): Promise<void> {
    const device = await this.repository.findById(input.id);

    if (!device || device.userId !== input.userId) {
      throw new NotFoundException();
    }

    await this.repository.delete(input.id);
  }
}
