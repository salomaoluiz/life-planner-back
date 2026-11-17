import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 115 FR 18, 22: incomes that live in another module (investment income series) but show up in finance. Finance
// only knows this port; the API layer binds it (modules never import each other). Everything is optional: with no
// source bound, finance behaves as before.
export interface ExternalProjectedIncome {
  accountId: string;
  assetId: string;
  categoryId: string;
  currency: CurrencyCode;
  date: string;
  description: string;
  number: number;
  seriesId: string;
  value: number;
}
export type IExternalProjectionSource = {
  // Runs before a finance read: the source creates the real rows it owes up to the end of `today`'s month.
  materialize(params: {
    owners: { archived?: boolean; owner: OwnerType; ownerId: string }[];
    today: string;
  }): Promise<void>;
  // The occurrences after the current month, from `from` to `to` (inclusive dates).
  findProjections(params: {
    from: string;
    owners: { archived?: boolean; owner: OwnerType; ownerId: string }[];
    to: string;
    today: string;
  }): Promise<ExternalProjectedIncome[]>;
};

export const EXTERNAL_PROJECTION_SOURCE = 'IExternalProjectionSource';
