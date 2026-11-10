import {
  InvestmentFeeKind,
  InvestmentFixedIncomeRedemptionKind,
  InvestmentOperationType,
} from '@investment/domain/enum';
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
  fxRate: null | string;
  generateTransaction: boolean;
  gross: number;
  id: string;
  // Spec 105: the real net of a redemption of a calculated title.
  netAmount: null | number;
  quantity: Decimal8;
  redemptionKind: InvestmentFixedIncomeRedemptionKind | null;
  total: number;
  transactionId: null | string;
  type: InvestmentOperationType;
  unitPrice: Decimal8;
}
