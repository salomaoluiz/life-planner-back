import { Inject } from '@nestjs/common';

import { ActivityItemInput } from '@activity/domain/entity/ActivityEntry';
import { ActivityOwnerRef, ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityAction, ActivityModule } from '@activity/domain/enum';
import { IActivityRepository } from '@activity/domain/repository/IActivityRepository';
import { buildChanges } from '@activity/domain/service/ActivityDiff';
import { buildSearchText } from '@activity/domain/service/ActivitySearchText';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export const PREVIEW_LABELS = 3;
// `search_text` stays bounded for a 2,000-row import.
const SEARCH_ITEM_LABELS = 500;

export interface RecordActivityInput {
  action: ActivityAction;
  actor: { id: null | string; name: string };
  after: ActivitySnapshot | null;
  batch: boolean;
  before: ActivitySnapshot | null;
  extra?: Record<string, unknown>;
  items?: ActivityItemInput[];
  now?: Date;
}

// An update after which the item is gone (a split left with one part dissolves) is a delete of it; an update of an
// item that did not exist (a valuation put on a new date) is a create.
function distinctOwners(snapshots: (ActivitySnapshot | null)[]): ActivityOwnerRef[] {
  const owners = new Map<string, ActivityOwnerRef>();

  snapshots.forEach((snapshot) =>
    snapshot?.owners.forEach((owner) => owners.set(`${owner.ownerType}:${owner.ownerId}`, owner)),
  );

  return [...owners.values()];
}
function effectiveAction(input: RecordActivityInput): ActivityAction {
  if (input.action !== ActivityAction.UPDATE) {
    return input.action;
  }

  if (!input.after && input.before) {
    return ActivityAction.DELETE;
  }

  return input.before ? input.action : ActivityAction.CREATE;
}

// Spec 127 FR 1, 3, 6, 7: one entry per owner touched, in the transaction of the request (the repository uses the
// ambient `Database.client`). A change that changes nothing records nothing.
export class RecordActivityUseCase implements UseCaseWithParams<RecordActivityInput, void> {
  constructor(@Inject('IActivityRepository') private readonly repository: IActivityRepository) {}

  async execute(input: RecordActivityInput): Promise<void> {
    const action = effectiveAction(input);
    const snapshot = action === ActivityAction.DELETE ? input.before : input.after;
    const items = input.items ?? [];

    if (!snapshot) {
      return;
    }

    const changes =
      action === ActivityAction.UPDATE && input.before && input.after
        ? buildChanges(input.before.fields, input.after.fields, [
            ...new Set([...Object.keys(input.after.fields), ...Object.keys(input.before.fields)]),
          ])
        : null;

    if (action === ActivityAction.UPDATE && changes?.length === 0 && items.length === 0) {
      return;
    }

    const modules = [...new Set([...(input.before?.modules ?? []), ...snapshot.modules])];
    const extra = {
      ...snapshot.extra,
      ...input.extra,
      ...(input.batch
        ? {
            itemCount: items.length,
            previewLabels: items.slice(0, PREVIEW_LABELS).map((item) => item.label),
          }
        : {}),
    };
    const searchText = buildSearchText({
      amountCents: snapshot.amountCents,
      itemLabels: items.slice(0, SEARCH_ITEM_LABELS).map((item) => item.label),
      label: snapshot.label,
      sources: snapshot.sources,
    });
    const occurredAt = input.now ?? new Date();

    for (const owner of distinctOwners([input.after, input.before])) {
      await this.repository.insert({
        action,
        actorId: input.actor.id,
        actorName: input.actor.name,
        batch: input.batch,
        changes: changes && changes.length > 0 ? changes : null,
        entityId: snapshot.entityId || null,
        entityType: snapshot.entityType,
        items,
        modules: modules as ActivityModule[],
        occurredAt,
        ownerId: owner.ownerId,
        ownerType: owner.ownerType,
        searchText,
        summary: {
          amountCents: snapshot.amountCents,
          bookingDate: snapshot.bookingDate,
          currency: snapshot.currency,
          extra: Object.keys(extra).length > 0 ? extra : undefined,
          label: snapshot.label,
          ownerName: owner.ownerName,
          sources: snapshot.sources,
        },
      });
    }
  }
}
