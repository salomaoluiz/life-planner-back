import { Injectable } from '@nestjs/common';

import {
  CreateInstallmentPlanApiInput,
  InstallmentPlanOutputShape,
  PrepayInstallmentPlanApiInput,
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
import { GetPrepaymentPreviewUseCase } from '@finance/application/use-case/GetPrepaymentPreviewUseCase';
import { PrepayInstallmentPlanUseCase } from '@finance/application/use-case/PrepayInstallmentPlanUseCase';
import { UndoInstallmentPrepaymentUseCase } from '@finance/application/use-case/UndoInstallmentPrepaymentUseCase';
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
      prepaid: row.prepaid,
      value: row.value,
    })),
    overLimit,
    plan: {
      categoryId: plan.categoryId,
      creditCardId: plan.creditCardId,
      currency: plan.currency,
      date: plan.date,
      description: plan.description,
      id: plan.id,
      installmentCount: plan.installmentCount,
      owner: plan.owner,
      ownerId: plan.ownerId,
      prepayment: plan.prepayment,
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
    private readonly getPrepaymentPreviewUseCase: GetPrepaymentPreviewUseCase,
    private readonly prepayInstallmentPlanUseCase: PrepayInstallmentPlanUseCase,
    private readonly undoInstallmentPrepaymentUseCase: UndoInstallmentPrepaymentUseCase,
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

  async prepay(
    userId: string,
    id: string,
    input: PrepayInstallmentPlanApiInput,
    today?: string,
  ): Promise<InstallmentPlanOutputShape> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const details = await this.prepayInstallmentPlanUseCase.execute({
      accessibleOwners,
      date: input.date,
      discount: input.discount,
      id,
      targetInvoiceMonth: input.targetInvoiceMonth,
      today: resolveToday(input.today ?? today),
    });

    return toInstallmentPlanOutput(details);
  }

  async prepaymentPreview(userId: string, id: string, targetInvoiceMonth: string, today?: string) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const { eligible, total } = await this.getPrepaymentPreviewUseCase.execute({
      accessibleOwners,
      id,
      targetInvoiceMonth,
      today: resolveToday(today),
    });

    return { eligible, total };
  }

  async undoPrepayment(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.undoInstallmentPrepaymentUseCase.execute({ accessibleOwners, id });
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
