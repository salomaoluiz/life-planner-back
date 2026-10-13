import { Injectable } from '@nestjs/common';

import { FamilyMember } from '@db/client';
import {
  CreateMemberDatasourceParams,
  FindMemberByEmailDatasourceParams,
  FindMembershipDatasourceParams,
  IFamilyMemberDatasource,
  JoinMemberDatasourceParams,
} from '@family/data/repository/datasource/IFamilyMemberDatasource';
import { Database } from '@shared/infra/db/Database';

// Prisma "Unique constraint failed". Duck-typed so tests (and other drivers) need no Prisma class.
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class FamilyMemberDatasource implements IFamilyMemberDatasource {
  constructor(private readonly db: Database) {}

  async create(params: CreateMemberDatasourceParams): Promise<FamilyMember | null> {
    try {
      return await this.db.client.familyMember.create({ data: params });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return null;
      }

      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.client.familyMember.deleteMany({ where: { id } });
  }

  async findByEmail(params: FindMemberByEmailDatasourceParams): Promise<FamilyMember | null> {
    return this.db.client.familyMember.findUnique({
      where: { family_id_email: { email: params.email, family_id: params.familyId } },
    });
  }

  async findByFamilyId(familyId: string): Promise<FamilyMember[]> {
    return this.db.client.familyMember.findMany({ where: { family_id: familyId } });
  }

  async findById(id: string): Promise<FamilyMember | null> {
    return this.db.client.familyMember.findUnique({ where: { id } });
  }

  async findByTokenHash(tokenHash: string): Promise<FamilyMember | null> {
    return this.db.client.familyMember.findUnique({ where: { invite_token: tokenHash } });
  }

  async findMembership(params: FindMembershipDatasourceParams): Promise<FamilyMember | null> {
    return this.db.client.familyMember.findFirst({
      where: { family_id: params.familyId, joined_at: { not: null }, user_id: params.userId },
    });
  }

  // One UPDATE ... WHERE user_id IS NULL: of two concurrent accepts only one row-lock winner matches.
  async join(params: JoinMemberDatasourceParams): Promise<FamilyMember | null> {
    const { count } = await this.db.client.familyMember.updateMany({
      data: {
        invite_expires_at: null,
        invite_token: null,
        joined_at: params.joined_at,
        user_id: params.user_id,
      },
      where: { id: params.id, user_id: null },
    });

    if (count === 0) {
      return null;
    }

    return this.db.client.familyMember.findUnique({ where: { id: params.id } });
  }
}
