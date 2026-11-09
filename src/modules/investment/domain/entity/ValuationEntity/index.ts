import { InvestmentValuationSource } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

export interface ValuationEntity {
  assetId: string;
  date: string;
  id: string;
  source: InvestmentValuationSource;
  unitPrice: Decimal8;
}
