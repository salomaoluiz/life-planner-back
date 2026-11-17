interface IStockLotEntity {
  createdAt: Date;
  id: string;
  itemId: string;
  quantity: number;
  // Optional properties (calendar days at UTC midnight)
  expirationDate?: Date;
  openedAt?: Date;
  purchaseDate?: Date;
}

class StockLotEntity {
  createdAt: Date;
  expirationDate?: Date;
  id: string;
  itemId: string;
  openedAt?: Date;
  purchaseDate?: Date;
  quantity: number;

  constructor(params: IStockLotEntity) {
    this.createdAt = params.createdAt;
    this.expirationDate = params.expirationDate;
    this.id = params.id;
    this.itemId = params.itemId;
    this.openedAt = params.openedAt;
    this.purchaseDate = params.purchaseDate;
    this.quantity = params.quantity;
  }
}

export default StockLotEntity;
