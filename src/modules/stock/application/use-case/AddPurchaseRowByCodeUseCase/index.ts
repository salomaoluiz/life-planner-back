import { BadRequestException, Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { IOpenFoodFacts } from '@shared/infra/open-food-facts';
import { uuidV4 } from '@shared/infra/uuid';
import { validate } from '@shared/infra/validation';
import {
  AddPurchaseRowByCodeInput,
  AddPurchaseRowByCodeSchema,
} from '@stock/application/dto/Purchase';
import {
  ensureRowsWritable,
  loadWritablePurchase,
} from '@stock/application/service/PurchaseAccess';
import { PurchaseRowView, toPurchaseRowView } from '@stock/application/service/PurchaseView';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import { IPurchaseRepository, IStockRepository } from '@stock/domain/repository';
import { normalizeBarcode } from '@stock/domain/service/Barcode';
import { mapOpenFoodFacts } from '@stock/domain/service/OpenFoodFactsMapping';

export interface AddPurchaseRowByCodeOutput {
  row: PurchaseRowView;
  source: ByCodeSource;
}
export type ByCodeSource = 'ITEM' | 'NONE' | 'OPEN_FOOD_FACTS';

// Spec 121 FR 25: the owner's item with the code, else an outside-the-list text row named by Open Food Facts
// (no AI call in the cart: it must stay fast and cheap), else a placeholder row for the user to rename.
export class AddPurchaseRowByCodeUseCase implements UseCaseWithParams<
  AddPurchaseRowByCodeInput,
  AddPurchaseRowByCodeOutput
> {
  constructor(
    @Inject('IPurchaseRepository')
    private readonly purchaseRepository: IPurchaseRepository,
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IOpenFoodFacts')
    private readonly openFoodFacts: IOpenFoodFacts,
  ) {}

  async execute(params: AddPurchaseRowByCodeInput): Promise<AddPurchaseRowByCodeOutput> {
    const input = validate(AddPurchaseRowByCodeSchema, params);
    const code = normalizeBarcode(input.code);

    if (code === undefined) {
      throw new BadRequestException('Invalid barcode');
    }

    const purchase = await loadWritablePurchase(
      this.purchaseRepository,
      input.accessibleOwners,
      input.purchaseId,
    );

    ensureRowsWritable(purchase, input.userId, new Date());

    const rowId = input.rowId ?? uuidV4();
    const [holder] = await this.stockRepository.findByOwners(
      [{ owner: purchase.owner, ownerId: purchase.ownerId }],
      { barcode: code },
    );
    const common = {
      clientId: input.clientId,
      purchaseId: purchase.id,
      rowId,
      userId: input.userId,
    };

    if (holder) {
      const { row } = await this.purchaseRepository.upsertRow({
        ...common,
        itemId: holder.id,
        quantity: holder.unit === StockUnits.UNIT ? 1 : undefined,
      });

      return { row: toPurchaseRowView(row, new Map()), source: 'ITEM' };
    }

    const product = await this.openFoodFacts.getProduct(code);
    const fields = product ? mapOpenFoodFacts(product) : {};
    const unit = fields.unit ?? StockUnits.UNIT;
    const { row } = await this.purchaseRepository.upsertRow({
      ...common,
      barcode: code,
      description: fields.description ?? `Produto ${code}`,
      quantity: unit === StockUnits.UNIT ? 1 : undefined,
      unit,
    });

    return {
      row: toPurchaseRowView(row, new Map()),
      source: fields.description ? 'OPEN_FOOD_FACTS' : 'NONE',
    };
  }
}
