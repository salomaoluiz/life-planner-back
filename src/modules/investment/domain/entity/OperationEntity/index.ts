import { InvestmentFeeKind, InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

export interface FeeEntity {
  amount: number;
  description: null | string;
  id: string;
  kind: InvestmentFeeKind;
}

// Money in integer cents; `date` is a calendar day (`YYYY-MM-DD`).
export interface FeeInput {
  amount: number;
  description: null | string;
  kind: InvestmentFeeKind;
}
export interface OperationEntity {
  accountId: null | string;
  assetId: string;
  createdAt: Date;
  date: string;
  fees: FeeEntity[];
  feesTotal: number;
  generateTransaction: boolean;
  gross: number;
  id: string;
  quantity: Decimal8;
  total: number;
  transactionId: null | string;
  type: InvestmentOperationType;
  unitPrice: Decimal8;
}
