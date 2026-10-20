import { Injectable } from '@nestjs/common';

import { Prisma } from '@db/client';
import { FinancialCategoryWithScopes } from '@finance/data/datasource/mapper/FinanceCategoryMapper';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  CategoryScopeDatasourceParams,
  CreateCategoryDatasourceParams,
  ExistsCategoryDatasourceParams,
  FindCategoriesByOwnersDatasourceParams,
  IFinanceCategoryDatasource,
  UpdateCategoryDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceCategoryDatasource';
import { Database } from '@shared/infra/db/Database';

const WITH_SCOPES = { scopes: true } as const;

@Injectable()
export class FinanceCategoryDatasource implements IFinanceCategoryDatasource {
  constructor(private readonly db: Database) {}

  async addScope(params: { creator_id: string } & CategoryScopeDatasourceParams): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const categories = await tx.financialCategory.findMany({
        select: { id: true },
        where: { all_scopes: true, creator_id: params.creator_id },
      });

      await tx.financialCategoryScope.createMany({
        data: categories.map((category) => ({
          category_id: category.id,
          owner: params.owner,
          owner_id: params.owner_id,
        })),
        skipDuplicates: true,
      });
    });
  }

  async create(params: CreateCategoryDatasourceParams): Promise<FinancialCategoryWithScopes> {
    const { scopes, ...data } = params;

    return this.db.client.financialCategory.create({
      data: { ...data, ...(scopes && { scopes: { create: scopes } }) },
      include: WITH_SCOPES,
    });
  }

  // `parent_id` is `ON DELETE CASCADE`: deleting a category removes its subtree in one statement.
  async delete(id: string): Promise<void> {
    await this.db.client.financialCategory.deleteMany({ where: { id } });
  }

  // Every ALL category of the creator that carries the family scope is copied (children keep their parent link),
  // the family's transactions, installment plans and recurrences move to the copies, then the scope rows go.
  async detachFamilyScope(params: { creator_id: string; family_id: string }): Promise<number> {
    return this.db.client.$transaction(async (tx) => {
      const familyScope = { owner: 'FAMILY' as const, owner_id: params.family_id };
      const originals = await tx.financialCategory.findMany({
        orderBy: { depth_level: 'asc' },
        where: {
          all_scopes: true,
          creator_id: params.creator_id,
          scopes: { some: familyScope },
        },
      });
      const copyIds = new Map<string, string>();

      for (const original of originals) {
        const copy = await tx.financialCategory.create({
          data: {
            all_scopes: false,
            depth_level: original.depth_level,
            icon: original.icon,
            icon_color: original.icon_color,
            name: original.name,
            owner: 'FAMILY',
            owner_id: params.family_id,
            parent_id: original.parent_id ? copyIds.get(original.parent_id) : undefined,
            type: original.type,
          },
        });

        copyIds.set(original.id, copy.id);
      }

      for (const [originalId, copyId] of copyIds) {
        const where = { category_id: originalId, ...familyScope };
        const data = { category_id: copyId };

        await tx.financialTransaction.updateMany({ data, where });
        await tx.financialInstallmentPlan.updateMany({ data, where });
        await tx.financialRecurrence.updateMany({ data, where });
      }

      await tx.financialCategoryScope.deleteMany({
        where: { category_id: { in: [...copyIds.keys()] }, ...familyScope },
      });

      return copyIds.size;
    });
  }

  async exists(params: ExistsCategoryDatasourceParams): Promise<boolean> {
    const found = await this.db.client.financialCategory.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return found !== null;
  }

  async findById(id: string): Promise<FinancialCategoryWithScopes | null> {
    return this.db.client.financialCategory.findUnique({
      include: WITH_SCOPES,
      where: { id },
    });
  }

  // One query: single-scope rows by owner, ALL rows by any of their scope rows (so each ALL row comes back once).
  async findByOwners(
    params: FindCategoriesByOwnersDatasourceParams,
  ): Promise<FinancialCategoryWithScopes[]> {
    const ownerWhere = toOwnerWhere(params.owners);

    return this.db.client.financialCategory.findMany({
      include: WITH_SCOPES,
      where: {
        OR: [
          { all_scopes: false, ...ownerWhere },
          { all_scopes: true, scopes: { some: ownerWhere } },
        ],
        ...(params.type && { type: params.type }),
      },
    });
  }

  async removeScope(params: CategoryScopeDatasourceParams): Promise<void> {
    await this.db.client.financialCategoryScope.deleteMany({
      where: { owner: params.owner, owner_id: params.owner_id },
    });
  }

  // The category and its subtree depths change atomically: all updates share one $transaction.
  async update(params: UpdateCategoryDatasourceParams): Promise<FinancialCategoryWithScopes> {
    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.db.client.financialCategory.update({
        data: {
          depth_level: params.depth_level,
          icon: params.icon,
          icon_color: params.icon_color,
          name: params.name,
          parent_id: params.parent_id,
          status: params.status,
          type: params.type,
        },
        include: WITH_SCOPES,
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

    if (params.status && params.subtree_ids?.length) {
      operations.push(
        this.db.client.financialCategory.updateMany({
          data: { status: params.status },
          where: { id: { in: params.subtree_ids } },
        }),
      );
    }

    const { scope } = params;

    if (scope) {
      const ids = [params.id, ...scope.subtree_ids];

      operations.push(
        this.db.client.financialCategory.updateMany({
          data: {
            all_scopes: true,
            creator_id: scope.creator_id,
            owner: 'USER',
            owner_id: scope.creator_id,
          },
          where: { id: { in: ids } },
        }),
        this.db.client.financialCategoryScope.deleteMany({ where: { category_id: { in: ids } } }),
        this.db.client.financialCategoryScope.createMany({
          data: ids.flatMap((categoryId) =>
            scope.scopes.map((item) => ({
              category_id: categoryId,
              owner: item.owner,
              owner_id: item.owner_id,
            })),
          ),
        }),
      );
    }

    const [updated] = (await this.db.client.$transaction(
      operations,
    )) as FinancialCategoryWithScopes[];

    // The scopes of the first statement predate the switch: read them back.
    return scope
      ? this.db.client.financialCategory.findUniqueOrThrow({
          include: WITH_SCOPES,
          where: { id: params.id },
        })
      : updated;
  }
}
