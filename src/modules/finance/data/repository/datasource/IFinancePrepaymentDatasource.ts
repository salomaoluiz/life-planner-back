import { FinancialInstallmentPrepayment, OwnerType } from '@db/client';
import { CurrencyCode } from '@finance/domain/enum/Currency';

export type FinancialPrepaymentWithDiscount = {
  discount_transaction: { value: number } | null;
} & FinancialInstallmentPrepayment;
export interface IFinancePrepaymentDatasource {
  findByPlanId(planId: string): Promise<FinancialPrepaymentWithDiscount | null>;
  prepay(params: PrepayDatasourceParams): Promise<FinancialPrepaymentWithDiscount>;
  undo(planId: string): Promise<void>;
}
export interface PrepayDatasourceParams {
  category_id: string;
  credit_card_id: string;
  currency: CurrencyCode;
  date: Date;
  discount: number;
  discount_description: string;
  owner: OwnerType;
  owner_id: string;
  plan_id: string;
  target_invoice_month: string;
}
