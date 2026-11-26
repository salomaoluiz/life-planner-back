import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { AppearanceCascade, CatalogMove } from '@stock/domain/repository';

interface CatalogRow {
  id: string;
  status: StockCatalogStatus;
}

export const MOVE_TO_NONE = 'none';

// Spec 125 FR 10 and section 6: an icon that is not in the shared catalog is refused (the API passes the names).
export function assertIcon(icon: string | undefined, iconCatalog: string[] | undefined): void {
  if (icon !== undefined && iconCatalog !== undefined && !iconCatalog.includes(icon)) {
    throw new UnprocessableEntityException({
      code: 'ICON_NOT_FOUND',
      message: 'Icon not found',
      statusCode: 422,
    });
  }
}

// FR 12: the icon and the tones for the ACTIVE descendants (never the row itself); a descendant missing from
// `childColors` keeps its color.
export function buildCascade(
  rows: CatalogRow[],
  descendants: string[],
  params: { applyToChildren: boolean; childColors?: Record<string, string>; icon?: string },
): AppearanceCascade | undefined {
  if (!params.applyToChildren) {
    return undefined;
  }

  const active = new Set(
    rows.filter((row) => row.status === StockCatalogStatus.ACTIVE).map((row) => row.id),
  );
  const ids = descendants.filter((id) => active.has(id));
  const colors = Object.fromEntries(
    Object.entries(params.childColors ?? {}).filter(([id]) => ids.includes(id)),
  );

  return ids.length === 0 ? undefined : { colors, icon: params.icon, ids };
}

// FR 20-23: nothing uses the subtree → plain delete; items and no decision → 409; else where the items go.
export function planDelete(
  rows: CatalogRow[],
  subtree: string[],
  itemCount: number,
  params: { inUseMessage: string; moveTo?: string },
): CatalogMove | undefined {
  if (itemCount === 0) {
    return undefined;
  }

  if (params.moveTo === undefined) {
    throw new ConflictException({ itemCount, message: params.inUseMessage, statusCode: 409 });
  }

  if (params.moveTo === MOVE_TO_NONE) {
    return { from: subtree, to: null };
  }

  const target = rows.find((row) => row.id === params.moveTo);

  if (!target || target.status !== StockCatalogStatus.ACTIVE || subtree.includes(target.id)) {
    throw new UnprocessableEntityException({
      code: 'INVALID_MOVE_TARGET',
      message: 'Move target must be an active row of the same owner outside the deleted subtree',
      statusCode: 422,
    });
  }

  return { from: subtree, to: target.id };
}
