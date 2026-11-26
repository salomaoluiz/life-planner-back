import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 124 FR 29: a lot inside its item's warning window (or already expired), as the notification collector needs it.
export interface ExpiringLot {
  description: string;
  // Calendar days from `today` to the effective expiration (negative = expired).
  daysLeft: number;
  // Effective expiration (116 FR 5), YYYY-MM-DD.
  expiresOn: string;
  itemId: string;
  location: null | string;
  lotId: string;
  opened: boolean;
  owner: OwnerType;
  ownerId: string;
  quantity: number;
  unit: string;
}

// The raw row of the datasource (dates still as Dates).
export interface ExpiringLotRow {
  description: string;
  expiration_date: Date | null;
  item_id: string;
  location: null | string;
  lot_id: string;
  opened_at: Date | null;
  opened_shelf_life_days: null | number;
  owner: string;
  owner_id: string;
  quantity: number;
  unit: string;
  warn_days_closed: number;
  warn_days_opened: number;
}
