import {
  InvestmentFeeKind,
  InvestmentFixedIncomeRedemptionKind,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

// Spec 108 FR 4-5: the numbers of an event operation (its quantity and money fields are zero).
export type EventData =
  | { kind: 'BONUS'; percent: Decimal8; unitCost: Decimal8 | null }
  | { kind: 'SPLIT'; ratioFrom: Decimal8; ratioTo: Decimal8 };
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
  // Set on SPLIT / REVERSE_SPLIT / BONUS.
  event: EventData | null;
  eventSuggestionId: null | string;
  fees: FeeEntity[];
  feesTotal: number;
  // Spec 108 FR 15: the event whose fraction this SELL sold.
  fractionOfOperationId: null | string;
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
