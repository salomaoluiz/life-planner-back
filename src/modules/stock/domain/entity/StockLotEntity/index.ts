interface IStockLotEntity {
  createdAt: Date;
  id: string;
  itemId: string;
  quantity: number;
  // Optional properties (calendar days at UTC midnight)
  currency?: string;
  expirationDate?: Date;
  leftoverDismissedAt?: Date;
  leftoverDismissedQuantity?: number;
  openedAt?: Date;
  purchaseDate?: Date;
  unitPriceCents?: number;
}

class StockLotEntity {
  createdAt: Date;
  currency?: string;
  expirationDate?: Date;
  id: string;
  itemId: string;
  leftoverDismissedAt?: Date;
  leftoverDismissedQuantity?: number;
  openedAt?: Date;
  purchaseDate?: Date;
  quantity: number;
  unitPriceCents?: number;

  constructor(params: IStockLotEntity) {
    this.createdAt = params.createdAt;
    this.currency = params.currency;
    this.leftoverDismissedAt = params.leftoverDismissedAt;
    this.leftoverDismissedQuantity = params.leftoverDismissedQuantity;
    this.unitPriceCents = params.unitPriceCents;
    this.expirationDate = params.expirationDate;
    this.id = params.id;
    this.itemId = params.itemId;
    this.openedAt = params.openedAt;
    this.purchaseDate = params.purchaseDate;
    this.quantity = params.quantity;
  }
}

export default StockLotEntity;
