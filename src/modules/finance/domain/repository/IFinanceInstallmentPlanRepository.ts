import InstallmentPlanEntity from '@finance/domain/entity/InstallmentPlanEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceInstallmentPlanRepository = {
  // One database transaction: the plan and its rows. Row k is `values[k]` on `months[k]`. Returns the plan id.
  createPlan(params: CreateInstallmentPlanRepositoryParams): Promise<string>;
  deletePlan(id: string): Promise<void>;
  // Plans of these categories (any status) with the closing day of their card, in one query (spec 041).
  findPlanById(id: string): Promise<InstallmentPlanEntity | undefined>;
  findPlansByCategoryIds(categoryIds: string[]): Promise<PlanWithClosingDay[]>;
  // Plans of these owners (any status) with the closing day of their card, in one query (spec 042).
  findPlansByOwners(owners: OwnerAccess[]): Promise<PlanWithClosingDay[]>;
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
interface PlanWithClosingDay {
  closingDay: number;
  plan: InstallmentPlanEntity;
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
  PlanWithClosingDay,
  RecreateInstallmentPlanRepositoryParams,
  UpdateInstallmentPlanTextRepositoryParams,
  UpdateInstallmentsFromRepositoryParams,
};
