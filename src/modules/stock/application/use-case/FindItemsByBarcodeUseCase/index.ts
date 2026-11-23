import { BadRequestException, Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  FindItemsByBarcodeInput,
  FindItemsByBarcodeSchema,
} from '@stock/application/dto/FindItemsByBarcode';
import {
  loadCatalogLookup,
  StockItemView,
  todayUtc,
  toStockItemView,
} from '@stock/application/service/StockView';
import { IStockCatalogRepository, IStockRepository } from '@stock/domain/repository';
import { normalizeBarcode } from '@stock/domain/service/Barcode';

export interface BarcodeLookup {
  code: string;
  views: StockItemView[];
}

// Spec 121 FR 8-9: the items holding the code in every owner the caller can read. Archived families are
// included (the sheet is read-only for them), unlike the "all owners" list of spec 116.
export class FindItemsByBarcodeUseCase implements UseCaseWithParams<
  FindItemsByBarcodeInput,
  BarcodeLookup
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: FindItemsByBarcodeInput): Promise<BarcodeLookup> {
    const input = validate(FindItemsByBarcodeSchema, params);
    const code = normalizeBarcode(input.code);

    if (code === undefined) {
      throw new BadRequestException('Invalid barcode');
    }

    const owners = input.accessibleOwners.map(({ owner, ownerId }) => ({ owner, ownerId }));
    const items = await this.stockRepository.findByOwners(owners, { barcode: code });

    if (items.length === 0) {
      return { code, views: [] };
    }

    const catalog = await loadCatalogLookup(this.catalogRepository, owners);
    const today = input.today ?? todayUtc();

    return { code, views: items.map((item) => toStockItemView(item, today, catalog)) };
  }
}
