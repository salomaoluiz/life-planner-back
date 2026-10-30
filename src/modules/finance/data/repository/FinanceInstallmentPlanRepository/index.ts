import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceInstallmentPlanMapper } from '@finance/data/datasource/mapper/FinanceInstallmentPlanMapper';
import { IFinanceInstallmentPlanDatasource } from '@finance/data/repository/datasource/IFinanceInstallmentPlanDatasource';
import InstallmentPlanEntity from '@finance/domain/entity/InstallmentPlanEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  CreateInstallmentPlanRepositoryParams,
  IFinanceInstallmentPlanRepository,
  PlanWithClosingDay,
  RecreateInstallmentPlanRepositoryParams,
  UpdateInstallmentPlanTextRepositoryParams,
  UpdateInstallmentsFromRepositoryParams,
} from '@finance/domain/repository';

@Injectable()
export class FinanceInstallmentPlanRepository implements IFinanceInstallmentPlanRepository {
  constructor(
    @Inject('IFinanceInstallmentPlanDatasource')
    private readonly planDatasource: IFinanceInstallmentPlanDatasource,
  ) {}

  async createPlan(params: CreateInstallmentPlanRepositoryParams): Promise<string> {
    return this.planDatasource.create({
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      currency: params.currency,
      date: fromCalendarDate(params.date),
      description: params.description,
      notes: params.notes,
      owner: params.owner,
      owner_id: params.ownerId,
      rows: toRows(params.months, params.values),
      tag_names: params.tags,
    });
  }

  async deletePlan(id: string): Promise<void> {
    await this.planDatasource.delete(id);
  }

  async findPlanById(id: string): Promise<InstallmentPlanEntity | undefined> {
    const result = await this.planDatasource.findById(id);

    return result ? FinanceInstallmentPlanMapper.toDomain(result) : undefined;
  }

  async findPlansByCategoryIds(categoryIds: string[]): Promise<PlanWithClosingDay[]> {
    const results = await this.planDatasource.findManyByCategoryIds(categoryIds);

    return results.map((result) => ({
      closingDay: result.credit_card.closing_day,
      plan: FinanceInstallmentPlanMapper.toDomain(result),
    }));
  }

  async findPlansByOwners(owners: OwnerAccess[]): Promise<PlanWithClosingDay[]> {
    const results = await this.planDatasource.findManyByOwners(owners);

    return results.map((result) => ({
      closingDay: result.credit_card.closing_day,
      plan: FinanceInstallmentPlanMapper.toDomain(result),
    }));
  }

  async recreatePlan(params: RecreateInstallmentPlanRepositoryParams): Promise<void> {
    await this.planDatasource.recreate({
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      date: fromCalendarDate(params.date),
      description: params.description,
      id: params.id,
      notes: params.notes,
      rows: toRows(params.months, params.values),
      tag_names: params.tags,
    });
  }

  async updateFromNumber(params: UpdateInstallmentsFromRepositoryParams): Promise<void> {
    await this.planDatasource.updateFromNumber({
      category_id: params.categoryId,
      description: params.description,
      from_number: params.fromNumber,
      notes: params.notes,
      plan_id: params.planId,
      tag_names: params.tags,
      value: params.value,
    });
  }

  async updatePlanText(params: UpdateInstallmentPlanTextRepositoryParams): Promise<void> {
    await this.planDatasource.updateText({
      category_id: params.categoryId,
      description: params.description,
      id: params.id,
      notes: params.notes,
      tag_names: params.tags,
    });
  }
}

function toRows(months: string[], values: number[]) {
  return values.map((value, index) => ({ invoice_month: months[index], value }));
}
