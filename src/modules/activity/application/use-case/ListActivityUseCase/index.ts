import { ForbiddenException, Inject } from '@nestjs/common';

import { ActivityEntryEntity } from '@activity/domain/entity/ActivityEntry';
import {
  ACTIVITY_PAGE_SIZE,
  ActivityActionFilter,
  ActivityEntityType,
  ActivityModule,
} from '@activity/domain/enum';
import { IActivityRepository } from '@activity/domain/repository/IActivityRepository';
import {
  decodeActivityCursor,
  encodeActivityCursor,
} from '@activity/domain/service/ActivityCursor';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

const DAY_MS = 86_400_000;
export const DEFAULT_WINDOW_DAYS = 30;

export interface ListActivityInput {
  accessibleOwners: { owner: OwnerType; ownerId: string }[];
  action?: ActivityActionFilter;
  actorId?: string;
  cursor?: string;
  from?: Date;
  module: ActivityModule;
  now?: Date;
  ownerId?: string;
  q?: string;
  retentionDays: number;
  to?: Date;
}
export interface ListActivityOutput {
  items: ListedActivityEntry[];
  nextCursor?: string;
}
export interface ListedActivityEntry extends ActivityEntryEntity {
  itemExists: boolean;
}

// Spec 127 FR 9, 10, 16: newest first, keyset pages of 50, `itemExists` with one query per entity type in the page.
export class ListActivityUseCase implements UseCaseWithParams<
  ListActivityInput,
  ListActivityOutput
> {
  constructor(@Inject('IActivityRepository') private readonly repository: IActivityRepository) {}

  async execute(input: ListActivityInput): Promise<ListActivityOutput> {
    const now = input.now ?? new Date();
    const oldest = new Date(now.getTime() - input.retentionDays * DAY_MS);
    const from = new Date(
      Math.max(
        (input.from ?? new Date(now.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS)).getTime(),
        oldest.getTime(),
      ),
    );
    const to = input.to ?? now;

    if (input.from && input.to && input.from.getTime() > input.to.getTime()) {
      throw new ValidationError([
        { code: 'invalid_range', field: 'from', message: '`from` must not be after `to`' },
      ]);
    }

    const cursor = input.cursor === undefined ? undefined : decodeActivityCursor(input.cursor);

    if (input.cursor !== undefined && !cursor) {
      throw new ValidationError([
        { code: 'invalid_cursor', field: 'cursor', message: 'Invalid cursor' },
      ]);
    }

    // "All" reads every owner of the user, archived families included (the history is read-only).
    const owners = input.accessibleOwners
      .filter((access) => input.ownerId === undefined || access.ownerId === input.ownerId)
      .map((access) => ({ ownerId: access.ownerId, ownerType: access.owner }));

    if (input.ownerId !== undefined && owners.length === 0) {
      throw new ForbiddenException('You cannot read this owner');
    }

    const page = await this.repository.list(
      {
        action: input.action,
        actorId: input.actorId,
        cursor,
        from,
        module: input.module,
        owners,
        q: input.q,
        to,
      },
      ACTIVITY_PAGE_SIZE,
    );
    const refs = new Map<ActivityEntityType, string[]>();

    page.rows
      .filter((row) => !row.batch && row.entityId !== null)
      .forEach((row) =>
        refs.set(row.entityType, [...(refs.get(row.entityType) ?? []), row.entityId as string]),
      );

    const existing = refs.size > 0 ? await this.repository.existingRefs(refs) : new Set<string>();
    const items = page.rows.map((row) => ({
      ...row,
      itemExists:
        row.action !== 'DELETE' &&
        !row.batch &&
        row.entityId !== null &&
        existing.has(`${row.entityType}:${row.entityId}`),
    }));
    const last = page.rows[page.rows.length - 1];

    return {
      items,
      nextCursor: page.hasMore
        ? encodeActivityCursor({ id: last.id, occurredAt: last.occurredAt })
        : undefined,
    };
  }
}
