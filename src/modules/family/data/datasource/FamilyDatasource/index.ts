import { Injectable } from '@nestjs/common';

import { Family } from '@db/client';
import {
  CreateFamilyDatasourceParams,
  DeleteUserDataDatasourceParams,
  IFamilyDatasource,
  IsMemberDatasourceParams,
  UpdateFamilyDatasourceParams,
  UserDataDeletion,
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

  async deleteUserData(params: DeleteUserDataDatasourceParams): Promise<UserDataDeletion> {
    // Owned families go with their member rows (cascade); the user's other memberships and the pending
    // invites addressed to the email go in the same transaction.
    const [families, memberships] = await this.db.client.$transaction([
      this.db.client.family.deleteMany({ where: { owner_id: params.userId } }),
      this.db.client.familyMember.deleteMany({
        where: {
          OR: [
            { user_id: params.userId },
            { email: { equals: params.email, mode: 'insensitive' }, user_id: null },
          ],
        },
      }),
    ]);

    return { families: families.count, memberships: memberships.count };
  }

  async findById(id: string): Promise<Family | null> {
    return this.db.client.family.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Family[]> {
    return this.db.client.family.findMany({
      where: { members: { some: { joined_at: { not: null }, user_id: userId } } },
    });
  }

  async findIdsByOwnerId(ownerId: string): Promise<string[]> {
    const rows = await this.db.client.family.findMany({
      select: { id: true },
      where: { owner_id: ownerId },
    });

    return rows.map((row) => row.id);
  }

  async isMember(params: IsMemberDatasourceParams): Promise<boolean> {
    const count = await this.db.client.familyMember.count({
      where: { family_id: params.familyId, joined_at: { not: null }, user_id: params.userId },
    });

    return count > 0;
  }

  async update(params: UpdateFamilyDatasourceParams): Promise<Family> {
    return this.db.client.family.update({
      data: {
        ...(params.name !== undefined && { name: params.name }),
        ...(params.status !== undefined && { status: params.status }),
      },
      where: { id: params.id },
    });
  }
}
