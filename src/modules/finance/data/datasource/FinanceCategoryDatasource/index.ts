import { Injectable } from '@nestjs/common';

import { FinancialCategory } from '@db/client';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  CreateCategoryDatasourceParams,
  ExistsCategoryDatasourceParams,
  FindCategoriesByOwnersDatasourceParams,
  IFinanceCategoryDatasource,
  UpdateCategoryDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceCategoryDatasource';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class FinanceCategoryDatasource implements IFinanceCategoryDatasource {
  constructor(private readonly db: Database) {}

  async create(params: CreateCategoryDatasourceParams): Promise<FinancialCategory> {
    return this.db.client.financialCategory.create({ data: params });
  }

  // `parent_id` is `ON DELETE CASCADE`: deleting a category removes its subtree in one statement.
  async delete(id: string): Promise<void> {
    await this.db.client.financialCategory.deleteMany({ where: { id } });
  }

  async exists(params: ExistsCategoryDatasourceParams): Promise<boolean> {
    const found = await this.db.client.financialCategory.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return found !== null;
  }

  async findById(id: string): Promise<FinancialCategory | null> {
    return this.db.client.financialCategory.findUnique({ where: { id } });
  }

  async findByOwners(params: FindCategoriesByOwnersDatasourceParams): Promise<FinancialCategory[]> {
    return this.db.client.financialCategory.findMany({
      where: { ...toOwnerWhere(params.owners), ...(params.type && { type: params.type }) },
    });
  }

  // The category and its subtree depths change atomically: all updates share one $transaction.
  async update(params: UpdateCategoryDatasourceParams): Promise<FinancialCategory> {
    const operations = [
      this.db.client.financialCategory.update({
        data: {
          depth_level: params.depth_level,
          icon: params.icon,
          icon_color: params.icon_color,
          name: params.name,
          parent_id: params.parent_id,
          type: params.type,
        },
        where: { id: params.id },
      }),
    ];

    for (const subtree of params.subtree_depths ?? []) {
      operations.push(
        this.db.client.financialCategory.update({
          data: { depth_level: subtree.depth_level },
          where: { id: subtree.id },
        }),
      );
    }

    const [updated] = await this.db.client.$transaction(operations);

    return updated;
  }
}
