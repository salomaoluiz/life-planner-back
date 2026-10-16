import { Injectable } from '@nestjs/common';

import {
  CreateInstallmentPlanApiInput,
  InstallmentPlanOutputShape,
  UpdateInstallmentPlanApiInput,
} from '@api/finance/v1/dto/installment-plan.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { resolveToday } from '@api/finance/v1/finance-query';
import { CreateInstallmentPlanUseCase } from '@finance/application/use-case/CreateInstallmentPlanUseCase';
import { DeleteInstallmentPlanUseCase } from '@finance/application/use-case/DeleteInstallmentPlanUseCase';
import {
  GetInstallmentPlanUseCase,
  InstallmentPlanDetails,
} from '@finance/application/use-case/GetInstallmentPlanUseCase';
import { UpdateInstallmentPlanUseCase } from '@finance/application/use-case/UpdateInstallmentPlanUseCase';

function toInstallmentPlanOutput({
  installments,
  overLimit,
  plan,
}: InstallmentPlanDetails): InstallmentPlanOutputShape {
  return {
    installments: installments.map((row) => ({
      id: row.id,
      installmentNumber: row.installmentNumber,
      invoiceMonth: row.invoiceMonth,
      invoiceStatus: row.invoiceStatus,
      value: row.value,
    })),
    overLimit,
    plan: {
      categoryId: plan.categoryId,
      creditCardId: plan.creditCardId,
      date: plan.date,
      description: plan.description,
      id: plan.id,
      installmentCount: plan.installmentCount,
      owner: plan.owner,
      ownerId: plan.ownerId,
      totalValue: plan.totalValue,
    },
  };
}

export { toInstallmentPlanOutput };

@Injectable()
export class InstallmentPlanService {
  constructor(
    private readonly createInstallmentPlanUseCase: CreateInstallmentPlanUseCase,
    private readonly deleteInstallmentPlanUseCase: DeleteInstallmentPlanUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getInstallmentPlanUseCase: GetInstallmentPlanUseCase,
    private readonly updateInstallmentPlanUseCase: UpdateInstallmentPlanUseCase,
  ) {}

  async create(
    userId: string,
    input: CreateInstallmentPlanApiInput,
    today?: string,
  ): Promise<InstallmentPlanOutputShape> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const details = await this.createInstallmentPlanUseCase.execute({
      ...input,
      accessibleOwners,
      today: resolveToday(input.today ?? today),
    });

    return toInstallmentPlanOutput(details);
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteInstallmentPlanUseCase.execute({ accessibleOwners, id });
  }

  async findOne(userId: string, id: string, today?: string): Promise<InstallmentPlanOutputShape> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const details = await this.getInstallmentPlanUseCase.execute({
      accessibleOwners,
      id,
      today: resolveToday(today),
    });

    return toInstallmentPlanOutput(details);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateInstallmentPlanApiInput,
    today?: string,
  ): Promise<InstallmentPlanOutputShape> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const details = await this.updateInstallmentPlanUseCase.execute({
      ...input,
      accessibleOwners,
      id,
      today: resolveToday(today),
    });

    return toInstallmentPlanOutput(details);
  }
}
