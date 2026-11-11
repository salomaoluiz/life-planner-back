import { Injectable } from '@nestjs/common';

import {
  ApproveSuggestionApiInput,
  CreateIncomeApiInput,
  IncomeOutputType,
  ReceiveIncomeApiInput,
  UpdateIncomeApiInput,
} from '@api/investment/v1/dto/income.dto';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { IncomeView } from '@investment/application/service/IncomeRules';
import { ApproveIncomeSuggestionUseCase } from '@investment/application/use-case/ApproveIncomeSuggestionUseCase';
import { CreateIncomeUseCase } from '@investment/application/use-case/CreateIncomeUseCase';
import { DeleteIncomeUseCase } from '@investment/application/use-case/DeleteIncomeUseCase';
import { GetIncomeByIdUseCase } from '@investment/application/use-case/GetIncomeByIdUseCase';
import { GetIncomeDefaultsUseCase } from '@investment/application/use-case/GetIncomeDefaultsUseCase';
import { GetIncomeSuggestionsUseCase } from '@investment/application/use-case/GetIncomeSuggestionsUseCase';
import { GetIncomesUseCase } from '@investment/application/use-case/GetIncomesUseCase';
import { ReceiveIncomeUseCase } from '@investment/application/use-case/ReceiveIncomeUseCase';
import { RejectIncomeSuggestionUseCase } from '@investment/application/use-case/RejectIncomeSuggestionUseCase';
import { UpdateIncomeUseCase } from '@investment/application/use-case/UpdateIncomeUseCase';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentIncomeType } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Nulls are left out, like the finance payload (spec 079).
export function toIncomeOutput(view: IncomeView): IncomeOutputType {
  const { income } = view;

  return {
    accountId: income.accountId ?? undefined,
    amountPerUnit: income.amountPerUnit ?? undefined,
    assetId: income.assetId,
    categoryId: income.categoryId ?? undefined,
    currency: income.currency,
    estimatedGross: view.estimatedGross,
    estimatedWithheld: view.estimatedWithheld,
    exDate: income.exDate ?? undefined,
    id: income.id,
    netAmount: income.netAmount,
    notes: income.notes ?? undefined,
    overdue: view.overdue,
    paymentDate: income.paymentDate,
    quantity: income.quantity ?? undefined,
    status: view.status,
    suggestionId: income.suggestionId ?? undefined,
    transactionId: income.transactionId ?? undefined,
    type: income.type,
    withholdingRate: view.withholdingRate,
  };
}

@Injectable()
export class IncomeService {
  constructor(
    private readonly approveIncomeSuggestionUseCase: ApproveIncomeSuggestionUseCase,
    private readonly createIncomeUseCase: CreateIncomeUseCase,
    private readonly deleteIncomeUseCase: DeleteIncomeUseCase,
    private readonly getIncomeByIdUseCase: GetIncomeByIdUseCase,
    private readonly getIncomeDefaultsUseCase: GetIncomeDefaultsUseCase,
    private readonly getIncomeSuggestionsUseCase: GetIncomeSuggestionsUseCase,
    private readonly getIncomesUseCase: GetIncomesUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly receiveIncomeUseCase: ReceiveIncomeUseCase,
    private readonly rejectIncomeSuggestionUseCase: RejectIncomeSuggestionUseCase,
    private readonly updateIncomeUseCase: UpdateIncomeUseCase,
  ) {}

  async approveSuggestion(userId: string, id: string, input: ApproveSuggestionApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const view = await this.approveIncomeSuggestionUseCase.execute({
      ...input,
      accessibleOwners,
      id,
      userId,
    });

    return { item: toIncomeOutput(view) };
  }

  async createIncome(userId: string, input: CreateIncomeApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return {
      item: toIncomeOutput(
        await this.createIncomeUseCase.execute({ ...input, accessibleOwners, userId }),
      ),
    };
  }

  async deleteIncome(userId: string, id: string): Promise<void> {
    await this.deleteIncomeUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
    });
  }

  async findDefaults(
    userId: string,
    assetId: string,
    query: { exDate?: string; type?: InvestmentIncomeType },
  ) {
    const defaults = await this.getIncomeDefaultsUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      assetId,
      ...query,
    });

    return {
      accountId: defaults.accountId,
      categoryId: defaults.categoryId,
      currency: defaults.currency,
      quantity: defaults.quantity,
      withholdingRate: defaults.withholdingRate,
    };
  }

  async findIncomeById(userId: string, id: string) {
    const view = await this.getIncomeByIdUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
    });

    return { item: toIncomeOutput(view) };
  }

  async findIncomes(
    userId: string,
    query: {
      assetId?: string;
      cursor?: string;
      from?: string;
      limit?: number;
      owner?: 'ALL' | 'FAMILY' | 'USER';
      ownerId?: string;
      status?: 'PLANNED' | 'RECEIVED';
      to?: string;
      type?: InvestmentIncomeType;
    },
  ) {
    const result = await this.getIncomesUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      ...query,
    });

    return {
      items: result.items.map((view) => toIncomeOutput(view)),
      nextCursor: result.nextCursor,
      ...(result.summary ? { summary: result.summary } : {}),
    };
  }

  async findSuggestions(
    userId: string,
    query: { assetId?: string; owner?: 'ALL' | 'FAMILY' | 'USER'; ownerId?: string },
  ) {
    const items = await this.getIncomeSuggestionsUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      ...query,
    });

    return {
      count: items.length,
      items: items.map(({ paymentDate, ...item }) => ({
        ...item,
        ...(paymentDate ? { paymentDate } : {}),
      })),
    };
  }

  async receiveIncome(userId: string, id: string, input: ReceiveIncomeApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return {
      item: toIncomeOutput(
        await this.receiveIncomeUseCase.execute({ ...input, accessibleOwners, id, userId }),
      ),
    };
  }

  async rejectSuggestion(userId: string, id: string): Promise<void> {
    await this.rejectIncomeSuggestionUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
      userId,
    });
  }

  async updateIncome(userId: string, id: string, input: UpdateIncomeApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return {
      item: toIncomeOutput(
        await this.updateIncomeUseCase.execute({ ...input, accessibleOwners, id, userId }),
      ),
    };
  }

  // Resolved on every request: the caller plus every family they own or joined.
  private async getAccessibleOwners(userId: string): Promise<OwnerAccess[]> {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);

    return [
      { owner: OwnerType.USER, ownerId: userId },
      ...families.map(({ archived, familyId }) => ({
        archived,
        owner: OwnerType.FAMILY,
        ownerId: familyId,
      })),
    ];
  }
}
