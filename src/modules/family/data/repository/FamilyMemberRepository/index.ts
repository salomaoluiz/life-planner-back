import { Inject, Injectable } from '@nestjs/common';

import { FamilyMemberMapper } from '@family/data/datasource/mapper/FamilyMemberMapper';
import { IFamilyMemberDatasource } from '@family/data/repository/datasource/IFamilyMemberDatasource';
import FamilyMemberEntity from '@family/domain/entity/FamilyMemberEntity';
import {
  CreateInviteRepositoryParams,
  FindMemberByEmailRepositoryParams,
  FindMembershipRepositoryParams,
  IFamilyMemberRepository,
  JoinRepositoryParams,
} from '@family/domain/repository';

@Injectable()
export class FamilyMemberRepository implements IFamilyMemberRepository {
  constructor(
    @Inject('IFamilyMemberDatasource')
    private readonly familyMemberDatasource: IFamilyMemberDatasource,
  ) {}

  async createInvite(
    params: CreateInviteRepositoryParams,
  ): Promise<FamilyMemberEntity | undefined> {
    const result = await this.familyMemberDatasource.create({
      email: params.email,
      family_id: params.familyId,
      invite_expires_at: params.inviteExpiresAt,
      invite_token: params.tokenHash,
    });

    return result ? FamilyMemberMapper.toDomain(result) : undefined;
  }

  async deleteById(id: string): Promise<void> {
    await this.familyMemberDatasource.delete(id);
  }

  async findByEmail(
    params: FindMemberByEmailRepositoryParams,
  ): Promise<FamilyMemberEntity | undefined> {
    const result = await this.familyMemberDatasource.findByEmail(params);

    return result ? FamilyMemberMapper.toDomain(result) : undefined;
  }

  async findByFamilyId(familyId: string): Promise<FamilyMemberEntity[]> {
    const result = await this.familyMemberDatasource.findByFamilyId(familyId);

    return result.map((member) => FamilyMemberMapper.toDomain(member));
  }

  async findById(id: string): Promise<FamilyMemberEntity | undefined> {
    const result = await this.familyMemberDatasource.findById(id);

    return result ? FamilyMemberMapper.toDomain(result) : undefined;
  }

  async findByTokenHash(tokenHash: string): Promise<FamilyMemberEntity | undefined> {
    const result = await this.familyMemberDatasource.findByTokenHash(tokenHash);

    return result ? FamilyMemberMapper.toDomain(result) : undefined;
  }

  async findMembership(
    params: FindMembershipRepositoryParams,
  ): Promise<FamilyMemberEntity | undefined> {
    const result = await this.familyMemberDatasource.findMembership(params);

    return result ? FamilyMemberMapper.toDomain(result) : undefined;
  }

  async join(params: JoinRepositoryParams): Promise<FamilyMemberEntity | undefined> {
    const result = await this.familyMemberDatasource.join({
      id: params.id,
      joined_at: params.joinedAt,
      user_id: params.userId,
    });

    return result ? FamilyMemberMapper.toDomain(result) : undefined;
  }
}
