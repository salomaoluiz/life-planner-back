import { Decimal8 } from '@shared/infra/decimal';

// Spec 112: links an origin asset and a destination asset; the numbers live on its two operations.
export interface ConversionEntity {
  cashAmount: null | number;
  cashReferenceUnitValue: Decimal8 | null;
  date: string;
  fromAssetId: string;
  id: string;
  ratioFrom: Decimal8;
  ratioTo: Decimal8;
  toAssetId: string;
}
// A conversion with the tickers of both sides, for the asset reads.
export interface ConversionDetail extends ConversionEntity {
  fromTicker: null | string;
  toTicker: null | string;
}
