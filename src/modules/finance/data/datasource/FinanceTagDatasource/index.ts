import { Injectable } from '@nestjs/common';

import { FinancialTagWithScopes } from '@finance/data/datasource/mapper/FinanceTagMapper';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  CreateTagDatasourceParams,
  ExistsTagDatasourceParams,
  FindTagConflictsDatasourceParams,
  FindTagsByOwnersDatasourceParams,
  IFinanceTagDatasource,
  TagScopeDatasourceParams,
  UpdateTagDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceTagDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { Database } from '@shared/infra/db/Database';

const WITH_SCOPES = { scopes: true } as const;

@Injectable()
export class FinanceTagDatasource implements IFinanceTagDatasource {
  constructor(private readonly db: Database) {}

  async addScope(params: { creator_id: string } & TagScopeDatasourceParams): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const tags = await tx.financialTag.findMany({
        select: { id: true },
        where: { all_scopes: true, creator_id: params.creator_id },
      });

      await tx.financialTagScope.createMany({
        data: tags.map((tag) => ({
          owner: params.owner,
          owner_id: params.owner_id,
          tag_id: tag.id,
        })),
        skipDuplicates: true,
      });
    });
  }

  // Two grouped queries (transactions, recurrences) for all the tags: no N+1.
  async countUsage(tagIds: string[], owners: OwnerAccess[]): Promise<Map<string, number>> {
    const usage = new Map<string, number>();

    if (tagIds.length === 0 || owners.length === 0) {
      return usage;
    }

    const ownerWhere = toOwnerWhere(owners);
    const [transactions, recurrences] = await Promise.all([
      this.db.client.financialTransactionTag.groupBy({
        _count: { _all: true },
        by: ['tag_id'],
        where: { tag_id: { in: tagIds }, transaction: ownerWhere },
      }),
      this.db.client.financialRecurrenceTag.groupBy({
        _count: { _all: true },
        by: ['tag_id'],
        where: { recurrence: ownerWhere, tag_id: { in: tagIds } },
      }),
    ]);

    for (const row of [...transactions, ...recurrences]) {
      usage.set(row.tag_id, (usage.get(row.tag_id) ?? 0) + row._count._all);
    }

    return usage;
  }

  async create(params: CreateTagDatasourceParams): Promise<FinancialTagWithScopes> {
    const { scopes, ...data } = params;

    return this.db.client.financialTag.create({
      data: { ...data, ...(scopes && { scopes: { create: scopes } }) },
      include: WITH_SCOPES,
    });
  }

  // The FKs are `ON DELETE CASCADE`: scopes and links go in the same statement.
  async delete(id: string): Promise<void> {
    await this.db.client.financialTag.deleteMany({ where: { id } });
  }

  // Every ALL tag of the creator that carries the family scope is copied for the family (or merged into the
  // family's own tag of the same name), the family's links move to the copy, then the scope rows go.
  async detachFamilyScope(params: { creator_id: string; family_id: string }): Promise<number> {
    return this.db.client.$transaction(async (tx) => {
      const familyScope = { owner: 'FAMILY' as const, owner_id: params.family_id };
      const originals = await tx.financialTag.findMany({
        where: { all_scopes: true, creator_id: params.creator_id, scopes: { some: familyScope } },
      });
      const own = await tx.financialTag.findMany({
        where: { all_scopes: false, ...familyScope },
      });
      const copyIds = new Map<string, string>();

      for (const original of originals) {
        const existing = own.find((tag) => tag.name.toLowerCase() === original.name.toLowerCase());
        const copyId =
          existing?.id ??
          (
            await tx.financialTag.create({
              data: {
                all_scopes: false,
                creator_id: params.family_id,
                name: original.name,
                ...familyScope,
              },
              select: { id: true },
            })
          ).id;

        copyIds.set(original.id, copyId);
      }

      for (const [originalId, copyId] of copyIds) {
        await repointLinks(tx, originalId, copyId, params.family_id);
      }

      await tx.financialTagScope.deleteMany({
        where: { tag_id: { in: [...copyIds.keys()] }, ...familyScope },
      });

      return copyIds.size;
    });
  }

  async exists(params: ExistsTagDatasourceParams): Promise<boolean> {
    const found = await this.db.client.financialTag.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return found !== null;
  }

  async findById(id: string): Promise<FinancialTagWithScopes | null> {
    return this.db.client.financialTag.findUnique({ include: WITH_SCOPES, where: { id } });
  }

  async findByOwners(params: FindTagsByOwnersDatasourceParams): Promise<FinancialTagWithScopes[]> {
    const ownerWhere = toOwnerWhere(params.owners);

    return this.db.client.financialTag.findMany({
      include: WITH_SCOPES,
      where: {
        OR: [
          { all_scopes: false, ...ownerWhere },
          { all_scopes: true, scopes: { some: ownerWhere } },
        ],
        ...(params.q && { name: { contains: params.q, mode: 'insensitive' } }),
      },
    });
  }

  async findConflicts(params: FindTagConflictsDatasourceParams): Promise<FinancialTagWithScopes[]> {
    const ownerWhere = toOwnerWhere(params.scopes);

    return this.db.client.financialTag.findMany({
      include: WITH_SCOPES,
      where: {
        name: { equals: params.name, mode: 'insensitive' },
        OR: [
          { all_scopes: false, ...ownerWhere },
          { all_scopes: true, scopes: { some: ownerWhere } },
        ],
        ...(params.exclude_id && { id: { not: params.exclude_id } }),
      },
    });
  }

  async removeScope(params: TagScopeDatasourceParams): Promise<void> {
    await this.db.client.financialTagScope.deleteMany({
      where: { owner: params.owner, owner_id: params.owner_id },
    });
  }

  async update(params: UpdateTagDatasourceParams): Promise<FinancialTagWithScopes> {
    const { scope } = params;

    return this.db.client.$transaction(async (tx) => {
      await tx.financialTag.update({
        data: {
          name: params.name,
          ...(scope && {
            all_scopes: true,
            creator_id: scope.creator_id,
            owner: 'USER' as const,
            owner_id: scope.creator_id,
          }),
        },
        where: { id: params.id },
      });

      if (scope) {
        await tx.financialTagScope.deleteMany({ where: { tag_id: params.id } });
        await tx.financialTagScope.createMany({
          data: scope.scopes.map((item) => ({
            owner: item.owner,
            owner_id: item.owner_id,
            tag_id: params.id,
          })),
        });
      }

      return tx.financialTag.findUniqueOrThrow({ include: WITH_SCOPES, where: { id: params.id } });
    });
  }
}

// The links of the records the family owns move from the ALL tag to its family copy.
async function repointLinks(
  tx: Parameters<Parameters<Database['client']['$transaction']>[0]>[0],
  fromId: string,
  toId: string,
  familyId: string,
) {
  const family = { owner: 'FAMILY' as const, owner_id: familyId };
  const transactionLinks = await tx.financialTransactionTag.findMany({
    where: { tag_id: fromId, transaction: family },
  });
  const recurrenceLinks = await tx.financialRecurrenceTag.findMany({
    where: { recurrence: family, tag_id: fromId },
  });

  // A record that already carries the copy keeps a single link.
  await tx.financialTransactionTag.deleteMany({
    where: {
      tag_id: fromId,
      transaction_id: { in: transactionLinks.map((link) => link.transaction_id) },
    },
  });
  await tx.financialTransactionTag.createMany({
    data: transactionLinks.map((link) => ({
      position: link.position,
      tag_id: toId,
      transaction_id: link.transaction_id,
    })),
    skipDuplicates: true,
  });
  await tx.financialRecurrenceTag.deleteMany({
    where: {
      recurrence_id: { in: recurrenceLinks.map((link) => link.recurrence_id) },
      tag_id: fromId,
    },
  });
  await tx.financialRecurrenceTag.createMany({
    data: recurrenceLinks.map((link) => ({
      position: link.position,
      recurrence_id: link.recurrence_id,
      tag_id: toId,
    })),
    skipDuplicates: true,
  });
}
