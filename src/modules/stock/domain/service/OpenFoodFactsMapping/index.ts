import { StockUnits } from '@stock/domain/entity/StockEntity';

export interface OffFields {
  brand?: string;
  description?: string;
  packageQuantity?: number;
  unit?: StockUnits;
}
export interface OffProduct {
  brands?: string;
  categories?: string[];
  name?: string;
  quantity?: string;
}

const DESCRIPTION_MAX = 100;
const QUANTITY_REGEX = /^\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z]*)\s*$/;
const THOUSAND = 1000;

// Spec 121 FR 14: `g` -> kg, `ml` -> L, a bare count -> UNIT; only the 116 units exist.
export function mapOpenFoodFacts(product: OffProduct): OffFields {
  const name = product.name?.trim().slice(0, DESCRIPTION_MAX);
  const brand = product.brands?.split(',')[0]?.trim();

  return {
    ...(brand ? { brand } : {}),
    ...(name ? { description: name } : {}),
    ...parsePackageQuantity(product.quantity),
  };
}
export function parsePackageQuantity(
  quantity: string | undefined,
): Pick<OffFields, 'packageQuantity' | 'unit'> {
  const match = quantity === undefined ? null : QUANTITY_REGEX.exec(quantity);

  if (!match) {
    return {};
  }

  const value = Number(match[1].replace(',', '.'));
  const label = match[2].toLowerCase();

  if (!(value > 0)) {
    return {};
  }

  function round(amount: number) {
    return Math.round(amount * THOUSAND) / THOUSAND;
  }

  switch (label) {
    case '':
    case 'un':
    case 'unit':
    case 'units':
      return { packageQuantity: value, unit: StockUnits.UNIT };
    case 'g':
      return { packageQuantity: round(value / THOUSAND), unit: StockUnits.KILOGRAM };
    case 'kg':
      return { packageQuantity: round(value), unit: StockUnits.KILOGRAM };
    case 'l':
      return { packageQuantity: round(value), unit: StockUnits.LITER };
    case 'ml':
      return { packageQuantity: round(value / THOUSAND), unit: StockUnits.LITER };
    default:
      return {};
  }
}
