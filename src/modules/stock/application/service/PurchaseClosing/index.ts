import { UnprocessableEntityException } from '@nestjs/common';

import { PurchaseRowRecord } from '@stock/domain/repository';
import { effectiveFinanceCategoryId, TreeCategory } from '@stock/domain/service/CategoryTree';
import {
  ClosingError,
  ClosingPlan,
  ClosingRow,
  planClosing,
} from '@stock/domain/service/ClosingPlan';
import { resolvePrice } from '@stock/domain/service/PurchaseMath';

export interface ClosingFinancePosting {
  accountId?: string;
  creditCardId?: string;
  currency: string;
  date: Date;
  description: string;
  invoiceMonth?: string;
  parts: ClosingPlan['parts'];
  total: number;
}
export interface ClosingRowChoice {
  rowId: string;
  // The finance mapping source: the category of the item the row ends up in.
  categoryId?: string;
  expirationDate?: Date;
  itemId?: string;
  lineTotalCents?: number;
  newItem?: { categoryId?: string; description: string; locationId?: string };
  quantity?: number;
  unitPriceCents?: number;
  unknownPrice?: boolean;
}

// FR 28: kg/L rows always need the quantity at closing (the stock needs it).
export function missingWeightRows(
  rows: PurchaseRowRecord[],
  choices: Map<string, ClosingRowChoice>,
): string[] {
  return rows
    .filter((row) => {
      const unit = row.item?.unit ?? row.unit;
      const quantity = choices.get(row.id)?.quantity ?? row.quantity;

      return unit !== undefined && unit !== 'unit' && !quantity;
    })
    .map((row) => row.id);
}

// FR 28/35: the stored rows with what the closing typed, ready for the pure plan.
export function toClosingRows(
  rows: PurchaseRowRecord[],
  choices: Map<string, ClosingRowChoice>,
  categories: TreeCategory[],
): {
  resolved: Map<string, { lineTotalCents?: number; quantity?: number; unitPriceCents?: number }>;
  rows: ClosingRow[];
} {
  const resolved = new Map<
    string,
    { lineTotalCents?: number; quantity?: number; unitPriceCents?: number }
  >();
  const closingRows = rows.map((row) => {
    const choice = choices.get(row.id);
    const quantity = choice?.quantity ?? row.quantity;
    let typed;

    if (choice?.unitPriceCents !== undefined) {
      typed = resolvePrice({ priceInput: 'UNIT', quantity, unitPriceCents: choice.unitPriceCents });
    } else if (choice?.lineTotalCents === undefined) {
      typed = resolvePrice({
        lineTotalCents: row.lineTotalCents,
        priceInput: row.priceInput,
        quantity,
        unitPriceCents: row.unitPriceCents,
      });
    } else {
      typed = resolvePrice({ lineTotalCents: choice.lineTotalCents, quantity });
    }

    const categoryId = choice?.categoryId ?? row.item?.categoryId;

    resolved.set(row.id, { ...typed, quantity });

    return {
      financeCategoryId: categoryId
        ? effectiveFinanceCategoryId(categories, categoryId)
        : undefined,
      id: row.id,
      lineTotalCents: choice?.unknownPrice ? undefined : typed.lineTotalCents,
      unknownPrice: choice?.unknownPrice,
    };
  });

  return { resolved, rows: closingRows };
}

// The closing rules answer 422 with their code (spec 120 §7).
export function runClosingPlan(input: Parameters<typeof planClosing>[0]): ClosingPlan {
  try {
    return planClosing(input);
  } catch (error) {
    if (error instanceof ClosingError) {
      throw new UnprocessableEntityException({ code: error.code, message: error.message });
    }

    throw error;
  }
}

// FR 36: "Compra no <market>" (pt-BR) / "Purchase at <market>" (en-US).
export function purchaseDescription(marketName: string, language?: 'en-US' | 'pt-BR'): string {
  return language === 'en-US' ? `Purchase at ${marketName}` : `Compra no ${marketName}`;
}
