import { Inject, Injectable } from '@nestjs/common';

import { FinanceTagMapper } from '@finance/data/datasource/mapper/FinanceTagMapper';
import { IFinanceTagDatasource } from '@finance/data/repository/datasource/IFinanceTagDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TagEntity from '@finance/domain/entity/TagEntity';
import { belongsToOwner } from '@finance/domain/entity/TagScope';
import {
  CreateTagRepositoryParams,
  FindTagConflictsRepositoryParams,
  FindTagsRepositoryParams,
  IFinanceTagRepository,
  UpdateTagRepositoryParams,
} from '@finance/domain/repository';

function toScopeRow(access: OwnerAccess) {
  return { owner: access.owner, owner_id: access.ownerId };
}

@Injectable()
export class FinanceTagRepository implements IFinanceTagRepository {
  constructor(
    @Inject('IFinanceTagDatasource')
    private readonly tagDatasource: IFinanceTagDatasource,
  ) {}

  async addScope(params: { creatorId: string; owner: OwnerAccess }): Promise<void> {
    await this.tagDatasource.addScope({
      creator_id: params.creatorId,
      owner: params.owner.owner,
      owner_id: params.owner.ownerId,
    });
  }

  async createTag(params: CreateTagRepositoryParams): Promise<TagEntity> {
    const result = await this.tagDatasource.create({
      all_scopes: params.allScopes,
      creator_id: params.creatorId,
      name: params.name,
      owner: params.owner,
      owner_id: params.ownerId,
      scopes: params.scopes?.map(toScopeRow),
    });

    return FinanceTagMapper.toDomain(result);
  }

  async deleteTag(id: string): Promise<void> {
    await this.tagDatasource.delete(id);
  }

  async detachFamilyScope(params: { creatorId: string; familyId: string }): Promise<number> {
    return this.tagDatasource.detachFamilyScope({
      creator_id: params.creatorId,
      family_id: params.familyId,
    });
  }

  async existsByOwner(access: OwnerAccess): Promise<boolean> {
    return this.tagDatasource.exists({ owner: access.owner, owner_id: access.ownerId });
  }

  async findConflictingScopes(params: FindTagConflictsRepositoryParams): Promise<OwnerAccess[]> {
    const result = await this.tagDatasource.findConflicts({
      exclude_id: params.excludeId,
      name: params.name,
      scopes: params.scopes,
    });
    const conflicts = result.map((row) => FinanceTagMapper.toDomain(row));

    return params.scopes.filter((scope) => conflicts.some((tag) => belongsToOwner(tag, scope)));
  }

  async findTagById(id: string): Promise<TagEntity | undefined> {
    const result = await this.tagDatasource.findById(id);

    return result ? FinanceTagMapper.toDomain(result) : undefined;
  }

  async findTags(params: FindTagsRepositoryParams): Promise<TagEntity[]> {
    const result = await this.tagDatasource.findByOwners({ owners: params.owners, q: params.q });
    const usage = await this.tagDatasource.countUsage(
      result.map((row) => row.id),
      params.owners,
    );

    return result.map((row) => FinanceTagMapper.toDomain(row, usage.get(row.id) ?? 0));
  }

  async removeScope(owner: OwnerAccess): Promise<void> {
    await this.tagDatasource.removeScope(toScopeRow(owner));
  }

  async updateTag(params: UpdateTagRepositoryParams): Promise<TagEntity> {
    const result = await this.tagDatasource.update({
      id: params.id,
      name: params.name,
      scope: params.scope && {
        creator_id: params.scope.creatorId,
        scopes: params.scope.scopes.map(toScopeRow),
      },
    });

    return FinanceTagMapper.toDomain(result);
  }
}
