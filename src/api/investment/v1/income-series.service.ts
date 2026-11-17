import { Injectable } from '@nestjs/common';

import {
  CreateIncomeSeriesApiInput,
  IncomeSeriesOutputType,
  UpdateIncomeSeriesApiInput,
} from '@api/investment/v1/dto/income-series.dto';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { IncomeSeriesView } from '@investment/application/service/IncomeSeriesRules';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import { CreateIncomeSeriesUseCase } from '@investment/application/use-case/CreateIncomeSeriesUseCase';
import { GetIncomeSeriesByIdUseCase } from '@investment/application/use-case/GetIncomeSeriesByIdUseCase';
import { GetIncomeSeriesProjectionsUseCase } from '@investment/application/use-case/GetIncomeSeriesProjectionsUseCase';
import { GetIncomeSeriesUseCase } from '@investment/application/use-case/GetIncomeSeriesUseCase';
import { MaterializeIncomeSeriesUseCase } from '@investment/application/use-case/MaterializeIncomeSeriesUseCase';
import { PreviewIncomeSeriesUseCase } from '@investment/application/use-case/PreviewIncomeSeriesUseCase';
import { UpdateIncomeSeriesUseCase } from '@investment/application/use-case/UpdateIncomeSeriesUseCase';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Nulls are left out, like the finance payload (spec 079).
export function toIncomeSeriesOutput(view: IncomeSeriesView): IncomeSeriesOutputType {
  const { series } = view;

  return {
    accountId: series.accountId ?? undefined,
    amountPerUnit: series.amountPerUnit,
    assetId: series.assetId,
    categoryId: series.categoryId ?? undefined,
    currency: series.currency,
    endDate: series.endDate ?? undefined,
    endedAt: series.endedAt ?? undefined,
    endReason: series.endReason ?? undefined,
    exDateOffsetDays: series.exDateOffsetDays ?? undefined,
    firstPaymentDate: series.firstPaymentDate,
    frequency: series.frequency,
    id: series.id,
    lastGeneratedNumber: series.lastGeneratedNumber,
    nextPaymentDate: view.nextPaymentDate ?? undefined,
    notes: series.notes ?? undefined,
    type: series.type,
    withFinance: series.withFinance,
  };
}

@Injectable()
export class IncomeSeriesService {
  constructor(
    private readonly createIncomeSeriesUseCase: CreateIncomeSeriesUseCase,
    private readonly getIncomeSeriesByIdUseCase: GetIncomeSeriesByIdUseCase,
    private readonly getIncomeSeriesProjectionsUseCase: GetIncomeSeriesProjectionsUseCase,
    private readonly getIncomeSeriesUseCase: GetIncomeSeriesUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly materializeIncomeSeriesUseCase: MaterializeIncomeSeriesUseCase,
    private readonly previewIncomeSeriesUseCase: PreviewIncomeSeriesUseCase,
    private readonly updateIncomeSeriesUseCase: UpdateIncomeSeriesUseCase,
  ) {}

  async create(userId: string, input: CreateIncomeSeriesApiInput) {
    const result = await this.createIncomeSeriesUseCase.execute({
      ...input,
      accessibleOwners: await this.getAccessibleOwners(userId),
      userId,
    });

    return { created: result.created, item: toIncomeSeriesOutput(result) };
  }

  async findById(userId: string, id: string) {
    const view = await this.getIncomeSeriesByIdUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
    });

    return { item: toIncomeSeriesOutput(view) };
  }

  async list(userId: string, assetId: string) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    await this.materializeIncomeSeriesUseCase.execute({
      accessibleOwners,
      today: todayInSaoPaulo(),
    });

    const views = await this.getIncomeSeriesUseCase.execute({ accessibleOwners, assetId });

    return { items: views.map((view) => toIncomeSeriesOutput(view)) };
  }

  async preview(userId: string, input: CreateIncomeSeriesApiInput) {
    return this.previewIncomeSeriesUseCase.execute({
      ...input,
      accessibleOwners: await this.getAccessibleOwners(userId),
    });
  }

  async projections(
    userId: string,
    query: { from: string; owner?: 'ALL' | 'FAMILY' | 'USER'; ownerId?: string; to: string },
  ) {
    const items = await this.getIncomeSeriesProjectionsUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      from: query.from,
      ownerIds: query.ownerId ? [query.ownerId] : undefined,
      to: query.to,
    });

    return {
      items: items.map((item) => ({
        ...item,
        accountId: item.accountId ?? undefined,
        categoryId: item.categoryId ?? undefined,
      })),
    };
  }

  async update(userId: string, id: string, input: UpdateIncomeSeriesApiInput) {
    const view = await this.updateIncomeSeriesUseCase.execute({
      ...input,
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
      userId,
    });

    return { item: toIncomeSeriesOutput(view) };
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
