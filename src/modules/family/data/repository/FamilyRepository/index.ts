import { Inject, Injectable } from '@nestjs/common';

import { FamilyMapper } from '@family/data/datasource/mapper/FamilyMapper';
import { IFamilyDatasource } from '@family/data/repository/datasource/IFamilyDatasource';
import FamilyEntity from '@family/domain/entity/FamilyEntity';
import {
  CreateFamilyRepositoryParams,
  IFamilyRepository,
  IsFamilyMemberRepositoryParams,
  UpdateFamilyRepositoryParams,
} from '@family/domain/repository';

@Injectable()
export class FamilyRepository implements IFamilyRepository {
  constructor(@Inject('IFamilyDatasource') private readonly familyDatasource: IFamilyDatasource) {}

  async createFamily(params: CreateFamilyRepositoryParams): Promise<FamilyEntity> {
    const result = await this.familyDatasource.create({
      email: params.ownerEmail,
      name: params.name,
      owner_id: params.ownerId,
    });

    return FamilyMapper.toDomain(result);
  }

  async deleteFamily(id: string): Promise<void> {
    await this.familyDatasource.delete(id);
  }

  async getFamilies(userId: string): Promise<FamilyEntity[]> {
    const result = await this.familyDatasource.findByUserId(userId);

    return result.map((family) => FamilyMapper.toDomain(family));
  }

  async getFamilyById(familyId: string): Promise<FamilyEntity | undefined> {
    const result = await this.familyDatasource.findById(familyId);

    return result ? FamilyMapper.toDomain(result) : undefined;
  }

  async isFamilyMember(params: IsFamilyMemberRepositoryParams): Promise<boolean> {
    return this.familyDatasource.isMember(params);
  }

  async updateFamily(params: UpdateFamilyRepositoryParams): Promise<FamilyEntity> {
    const result = await this.familyDatasource.update({ id: params.id, name: params.name });

    return FamilyMapper.toDomain(result);
  }
}
