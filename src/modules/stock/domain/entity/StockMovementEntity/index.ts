export enum StockMovementReasons {
  EXPIRED = 'EXPIRED',
  MANUAL = 'MANUAL',
  OTHER = 'OTHER',
  PURCHASE = 'PURCHASE',
  SPOILED = 'SPOILED',
}
export enum StockMovementTypes {
  ADJUST = 'ADJUST',
  CONSUME = 'CONSUME',
  DISCARD = 'DISCARD',
  ENTRY = 'ENTRY',
  INITIAL = 'INITIAL',
  OPEN = 'OPEN',
}

interface IStockMovementEntity {
  createdAt: Date;
  id: string;
  itemId: string;
  lotId: string;
  // Signed delta; OPEN records the opened quantity.
  quantity: number;
  type: StockMovementTypes;
  // Optional properties
  gestureId?: string;
  note?: string;
  reason?: StockMovementReasons;
  userId?: string;
}

class StockMovementEntity {
  createdAt: Date;
  gestureId?: string;
  id: string;
  itemId: string;
  lotId: string;
  note?: string;
  quantity: number;
  reason?: StockMovementReasons;
  type: StockMovementTypes;
  userId?: string;

  constructor(params: IStockMovementEntity) {
    this.createdAt = params.createdAt;
    this.gestureId = params.gestureId;
    this.id = params.id;
    this.itemId = params.itemId;
    this.lotId = params.lotId;
    this.note = params.note;
    this.quantity = params.quantity;
    this.reason = params.reason;
    this.type = params.type;
    this.userId = params.userId;
  }
}

export default StockMovementEntity;
