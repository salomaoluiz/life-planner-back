import InstallmentPlanEntity from '@finance/domain/entity/InstallmentPlanEntity';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceInstallmentPlanRepository = {
  // One database transaction: the plan and its rows. Row k is `values[k]` on `months[k]`. Returns the plan id.
  createPlan(params: CreateInstallmentPlanRepositoryParams): Promise<string>;
  deletePlan(id: string): Promise<void>;
  findPlanById(id: string): Promise<InstallmentPlanEntity | undefined>;
  // Deletes the rows and creates them again (per-installment adjustments are lost).
  recreatePlan(params: RecreateInstallmentPlanRepositoryParams): Promise<void>;
  // Rows with `installmentNumber >= fromNumber`; `value` is refused when one of them is paid.
  updateFromNumber(params: UpdateInstallmentsFromRepositoryParams): Promise<void>;
  // Plan and ALL its rows (paid ones included).
  updatePlanText(params: UpdateInstallmentPlanTextRepositoryParams): Promise<void>;
};

interface CreateInstallmentPlanRepositoryParams {
  categoryId: string;
  creditCardId: string;
  currency: CurrencyCode;
  date: string;
  description: string;
  months: string[];
  owner: OwnerType;
  ownerId: string;
  values: number[];
}
interface RecreateInstallmentPlanRepositoryParams {
  categoryId: string;
  creditCardId: string;
  date: string;
  description: string;
  id: string;
  months: string[];
  values: number[];
}
interface UpdateInstallmentPlanTextRepositoryParams {
  categoryId?: string;
  description?: string;
  id: string;
}
interface UpdateInstallmentsFromRepositoryParams {
  categoryId?: string;
  description?: string;
  fromNumber: number;
  planId: string;
  value?: number;
}

export {
  CreateInstallmentPlanRepositoryParams,
  RecreateInstallmentPlanRepositoryParams,
  UpdateInstallmentPlanTextRepositoryParams,
  UpdateInstallmentsFromRepositoryParams,
};
