import { ActivityEntityType, ActivityModule } from '@activity/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export interface ActivityOwnerRef {
  ownerId: string;
  ownerName: string;
  ownerType: OwnerType;
}

// Spec 127 FR 6, 7: an item as it is at one moment. `fields` holds only the user-editable fields, ids already
// resolved to snapshot names; nothing derived (balances, totals, positions) and no timestamps.
export interface ActivitySnapshot {
  amountCents?: number;
  bookingDate?: string;
  currency?: string;
  entityId: string;
  entityType: ActivityEntityType;
  extra?: Record<string, unknown>;
  fields: Record<string, unknown>;
  label: string;
  modules: ActivityModule[];
  owners: ActivityOwnerRef[];
  // Ids the recorder needs to find the rows of a batch (never stored): the series or plan a row belongs to.
  refs?: Record<string, null | string>;
  sources?: string[];
}
