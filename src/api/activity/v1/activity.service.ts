import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { ListActivityItemsUseCase } from '@activity/application/use-case/ListActivityItemsUseCase';
import { ListActivityUseCase } from '@activity/application/use-case/ListActivityUseCase';
import {
  ActivityItemsQuerySchema,
  ActivityListQuerySchema,
} from '@api/activity/v1/dto/activity.dto';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { EnvService } from '@shared/infra/env/env.service';

type ItemsQuery = z.output<typeof ActivityItemsQuerySchema>;
type ListQuery = z.output<typeof ActivityListQuerySchema>;

// Spec 127 section 4: the owners the user can read are themself and every family they belong to, archived ones
// included (the history is read-only).
@Injectable()
export class ActivityService {
  constructor(
    private readonly env: EnvService,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly listActivityUseCase: ListActivityUseCase,
    private readonly listActivityItemsUseCase: ListActivityItemsUseCase,
  ) {}

  private async accessibleOwners(userId: string) {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);

    return [
      { owner: OwnerType.USER, ownerId: userId },
      ...families.map(({ familyId }) => ({ owner: OwnerType.FAMILY, ownerId: familyId })),
    ];
  }

  async list(userId: string, query: ListQuery) {
    const result = await this.listActivityUseCase.execute({
      accessibleOwners: await this.accessibleOwners(userId),
      action: query.action,
      actorId: query.actorId,
      cursor: query.cursor,
      from: query.from === undefined ? undefined : new Date(query.from),
      module: query.module,
      ownerId: query.ownerId,
      q: query.q,
      retentionDays: this.env.activityRetentionDays,
      to: query.to === undefined ? undefined : new Date(query.to),
    });

    return {
      items: result.items.map((entry) => ({
        action: entry.action,
        actor: { id: entry.actorId, name: entry.actorName },
        batch: entry.batch,
        batchPreview: entry.batchPreview,
        changes: entry.changes,
        entityId: entry.entityId,
        entityType: entry.entityType,
        id: entry.id,
        itemExists: entry.itemExists,
        modules: entry.modules,
        occurredAt: entry.occurredAt.toISOString(),
        owner: { id: entry.ownerId, name: entry.summary.ownerName, type: entry.ownerType },
        summary: {
          amountCents: entry.summary.amountCents,
          bookingDate: entry.summary.bookingDate,
          currency: entry.summary.currency,
          extra: entry.summary.extra,
          label: entry.summary.label,
          sources: entry.summary.sources,
        },
      })),
      nextCursor: result.nextCursor ?? null,
    };
  }

  async listItems(userId: string, id: string, query: ItemsQuery) {
    const result = await this.listActivityItemsUseCase.execute({
      accessibleOwners: await this.accessibleOwners(userId),
      cursor: query.cursor,
      id,
      q: query.q,
    });

    return {
      header: result.header ?? null,
      items: result.items.map((item) => ({
        action: item.action,
        amountCents: item.amountCents ?? null,
        bookingDate: item.bookingDate ?? null,
        currency: item.currency ?? null,
        entityId: item.entityId,
        entityType: item.entityType,
        itemExists: item.itemExists,
        label: item.label,
        sourceName: item.sourceName ?? null,
      })),
      nextCursor: result.nextCursor ?? null,
    };
  }
}
