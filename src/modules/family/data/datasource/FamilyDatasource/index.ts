import { Injectable } from '@nestjs/common';

import { Family } from '@db/client';
import {
  CreateFamilyDatasourceParams,
  IFamilyDatasource,
  IsMemberDatasourceParams,
  UpdateFamilyDatasourceParams,
} from '@family/data/repository/datasource/IFamilyDatasource';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class FamilyDatasource implements IFamilyDatasource {
  constructor(private readonly db: Database) {}

  // A nested write: Prisma runs the family insert and the owner membership insert in ONE transaction.
  async create(params: CreateFamilyDatasourceParams): Promise<Family> {
    const { email, name, owner_id } = params;

    return this.db.client.family.create({
      data: {
        members: {
          create: { email, joined_at: new Date(), user_id: owner_id },
        },
        name,
        owner_id,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.family.deleteMany({ where: { id } });
  }

  async findById(id: string): Promise<Family | null> {
    return this.db.client.family.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Family[]> {
    return this.db.client.family.findMany({
      where: { members: { some: { joined_at: { not: null }, user_id: userId } } },
    });
  }

  async isMember(params: IsMemberDatasourceParams): Promise<boolean> {
    const count = await this.db.client.familyMember.count({
      where: { family_id: params.familyId, joined_at: { not: null }, user_id: params.userId },
    });

    return count > 0;
  }

  async update(params: UpdateFamilyDatasourceParams): Promise<Family> {
    return this.db.client.family.update({
      data: { name: params.name },
      where: { id: params.id },
    });
  }
}
