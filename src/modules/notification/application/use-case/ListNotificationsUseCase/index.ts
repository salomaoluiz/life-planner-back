import { Inject } from '@nestjs/common';

import { NotificationEntity } from '@notification/domain/entity/NotificationEntity';
import { NotificationModule } from '@notification/domain/enum';
import { INotificationRepository } from '@notification/domain/repository';
import {
  decodeNoticeCursor,
  encodeNoticeCursor,
  NOTICE_PAGE_SIZE,
} from '@notification/domain/service/NoticeCursor';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { ValidationError } from '@shared/domain/error/ValidationError';

export interface ListNotificationsInput {
  cursor?: string;
  module?: NotificationModule;
  unread?: boolean;
  userId: string;
}
export interface ListNotificationsOutput {
  items: NotificationEntity[];
  nextCursor?: string;
}

// Spec 124 FR 18: the center, newest first, keyset pages of 20.
export class ListNotificationsUseCase implements UseCaseWithParams<
  ListNotificationsInput,
  ListNotificationsOutput
> {
  constructor(
    @Inject('INotificationRepository') private readonly repository: INotificationRepository,
  ) {}

  async execute(input: ListNotificationsInput): Promise<ListNotificationsOutput> {
    const cursor = input.cursor === undefined ? undefined : decodeNoticeCursor(input.cursor);

    if (input.cursor !== undefined && !cursor) {
      throw new ValidationError([
        { code: 'invalid_cursor', field: 'cursor', message: 'Invalid cursor' },
      ]);
    }

    const rows = await this.repository.findPage({
      cursor,
      limit: NOTICE_PAGE_SIZE + 1,
      module: input.module,
      unread: input.unread,
      userId: input.userId,
    });
    const items = rows.slice(0, NOTICE_PAGE_SIZE);
    const last = items[items.length - 1];

    return {
      items,
      nextCursor: rows.length > NOTICE_PAGE_SIZE ? encodeNoticeCursor(last) : undefined,
    };
  }
}
