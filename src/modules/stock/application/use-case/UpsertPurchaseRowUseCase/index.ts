import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  UpsertPurchaseRowInput,
  UpsertPurchaseRowParsed,
  UpsertPurchaseRowSchema,
} from '@stock/application/dto/Purchase';
import {
  ensureRowsWritable,
  loadWritablePurchase,
} from '@stock/application/service/PurchaseAccess';
import { PurchaseRowView, toPurchaseRowView } from '@stock/application/service/PurchaseView';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import {
  IPurchaseRepository,
  IShoppingListRepository,
  IStockRepository,
  PurchaseRowRecord,
  UpsertPurchaseRowResult,
} from '@stock/domain/repository';
import { resolvePrice } from '@stock/domain/service/PurchaseMath';
import { quantityError } from '@stock/domain/service/StockQuantity';

export interface UpsertPurchaseRowOutput {
  conflict?: UpsertPurchaseRowResult['conflict'];
  convertedToOutside: boolean;
  row: PurchaseRowView;
}

// FR 14: the typed price wins; a quantity change keeps the typed one and recomputes the other.
function pricesOf(input: UpsertPurchaseRowParsed, existing?: PurchaseRowRecord) {
  const quantity =
    input.quantity === undefined ? existing?.quantity : (input.quantity ?? undefined);

  if (input.unitPriceCents === null || input.lineTotalCents === null) {
    return { lineTotalCents: null, priceInput: undefined, quantity, unitPriceCents: null };
  }

  if (input.unitPriceCents !== undefined) {
    return {
      ...resolvePrice({ priceInput: 'UNIT', quantity, unitPriceCents: input.unitPriceCents }),
      quantity,
    };
  }

  if (input.lineTotalCents !== undefined) {
    return { ...resolvePrice({ lineTotalCents: input.lineTotalCents, quantity }), quantity };
  }

  if (existing && input.quantity !== undefined && existing.priceInput) {
    return {
      ...resolvePrice({
        lineTotalCents: existing.lineTotalCents,
        priceInput: existing.priceInput,
        quantity,
        unitPriceCents: existing.unitPriceCents,
      }),
      quantity,
    };
  }

  return { quantity };
}

// Spec 120 FR 12-18: one idempotent write of a purchase row (tick, price, expiration, "Não tinha").
export class UpsertPurchaseRowUseCase implements UseCaseWithParams<
  UpsertPurchaseRowInput,
  UpsertPurchaseRowOutput
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: UpsertPurchaseRowInput): Promise<UpsertPurchaseRowOutput> {
    const input = validate(UpsertPurchaseRowSchema, params);
    const purchase = await loadWritablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.purchaseId,
    );

    ensureRowsWritable(purchase, input.userId, new Date());

    const existing = (await this.purchaseRepository.findRows([purchase.id])).find(
      (row) => row.id === input.rowId,
    );
    let unit: StockUnits | undefined = input.unit ?? existing?.item?.unit ?? existing?.unit;

    if (input.itemId) {
      const item = await this.stockRepository.findById(input.itemId);

      if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
        throw new NotFoundException();
      }

      if (item.owner !== purchase.owner || item.ownerId !== purchase.ownerId) {
        throw new UnprocessableEntityException('The item belongs to another owner');
      }

      unit = item.unit;
    }

    if (input.listRowId) {
      const record = await this.listRepository.findRowById(input.listRowId);

      if (!record || record.list.id !== purchase.listId) {
        throw new NotFoundException();
      }

      unit = record.item?.unit ?? record.row.unit;
    }

    const prices = pricesOf(input, existing);
    const error = unit && prices.quantity ? quantityError(unit, prices.quantity) : undefined;

    if (error) {
      throw new UnprocessableEntityException(error);
    }

    const result = await this.purchaseRepository.upsertRow({
      clientId: input.clientId,
      description: input.description,
      expirationDate: input.expirationDate,
      itemId: input.itemId,
      lineTotalCents: prices.lineTotalCents,
      listRowId: input.listRowId,
      priceInput: prices.priceInput,
      purchaseId: purchase.id,
      quantity: input.quantity === undefined ? undefined : prices.quantity,
      rowId: input.rowId,
      state: input.state,
      unit: input.unit,
      unitPriceCents: prices.unitPriceCents,
      userId: input.userId,
    });

    return {
      conflict: result.conflict,
      convertedToOutside: result.convertedToOutside,
      row: toPurchaseRowView(result.row, new Map()),
    };
  }
}
