import { Inject, NotFoundException } from '@nestjs/common';

import { ActivityItemEntity, BatchHeader } from '@activity/domain/entity/ActivityEntry';
import { ACTIVITY_PAGE_SIZE, ActivityEntityType } from '@activity/domain/enum';
import { IActivityRepository } from '@activity/domain/repository/IActivityRepository';
import { decodeItemCursor, encodeItemCursor } from '@activity/domain/service/ActivityCursor';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

export interface ListActivityItemsInput {
  accessibleOwners: { owner: OwnerType; ownerId: string }[];
  cursor?: string;
  id: string;
  q?: string;
}
export interface ListActivityItemsOutput {
  header?: { existing: number } & BatchHeader;
  items: ListedBatchItem[];
  nextCursor?: string;
}
export interface ListedBatchItem extends ActivityItemEntity {
  itemExists: boolean;
}

// Spec 127 FR 11: the items of one batch entry, 50 per page, with the header (first page only).
export class ListActivityItemsUseCase implements UseCaseWithParams<
  ListActivityItemsInput,
  ListActivityItemsOutput
> {
  constructor(@Inject('IActivityRepository') private readonly repository: IActivityRepository) {}

  async execute(input: ListActivityItemsInput): Promise<ListActivityItemsOutput> {
    const entry = await this.repository.findEntry(
      input.id,
      input.accessibleOwners.map((access) => ({
        ownerId: access.ownerId,
        ownerType: access.owner,
      })),
    );

    if (!entry || !entry.batch) {
      throw new NotFoundException('Activity entry not found');
    }

    const cursor = input.cursor === undefined ? undefined : decodeItemCursor(input.cursor);

    if (input.cursor !== undefined && !cursor) {
      throw new ValidationError([
        { code: 'invalid_cursor', field: 'cursor', message: 'Invalid cursor' },
      ]);
    }

    const first = input.cursor === undefined;
    const page = await this.repository.listItems(
      { cursor, entryId: entry.id, q: input.q },
      ACTIVITY_PAGE_SIZE,
      first,
    );
    const refs = new Map<ActivityEntityType, string[]>();

    page.items
      .filter((item) => item.action !== 'DELETE')
      .forEach((item) =>
        refs.set(item.entityType, [...(refs.get(item.entityType) ?? []), item.entityId]),
      );

    const existing = refs.size > 0 ? await this.repository.existingRefs(refs) : new Set<string>();
    const items = page.items.map((item) => ({
      ...item,
      itemExists: item.action !== 'DELETE' && existing.has(`${item.entityType}:${item.entityId}`),
    }));
    const last = page.items[page.items.length - 1];

    return {
      header:
        first && page.header
          ? { ...page.header, existing: await this.countExisting(page.header.count, entry.id) }
          : undefined,
      items,
      nextCursor: page.hasMore
        ? encodeItemCursor({ bookingDate: last.bookingDate ?? null, id: last.id })
        : undefined,
    };
  }

  // Header "still exist": every item of the batch, one query per entity type.
  private async countExisting(count: number, entryId: string): Promise<number> {
    const refs = await this.repository.listItemRefs(entryId);
    const byType = new Map<ActivityEntityType, string[]>();

    refs.forEach((ref) =>
      byType.set(ref.entityType, [...(byType.get(ref.entityType) ?? []), ref.entityId]),
    );

    const existing = await this.repository.existingRefs(byType);

    return Math.min(
      count,
      refs.filter((ref) => existing.has(`${ref.entityType}:${ref.entityId}`)).length,
    );
  }
}
