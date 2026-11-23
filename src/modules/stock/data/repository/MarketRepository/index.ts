import { ConflictException, Injectable } from '@nestjs/common';

import { AccountStatus, OwnerType, Prisma, StockMarket } from '@db/client';
import { OwnerType as DomainOwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';
import { toOwnerWhere } from '@stock/data/datasource/mapper/OwnerWhere';
import MarketEntity from '@stock/domain/entity/MarketEntity';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import {
  CreateMarketParams,
  IMarketRepository,
  UpdateMarketParams,
} from '@stock/domain/repository';

const UNIQUE_VIOLATION = 'P2002';

export function toMarket(raw: StockMarket): MarketEntity {
  return new MarketEntity({
    createdAt: raw.created_at,
    id: raw.id,
    name: raw.name,
    neighborhood: raw.neighborhood ?? undefined,
    owner: DomainOwnerType[raw.owner],
    ownerId: raw.owner_id,
    status: StockCatalogStatus[raw.status],
    updatedAt: raw.updated_at,
  });
}

// Spec 120 FR 9: names are unique among the owner's active markets (case-insensitive index → 409).
function rethrowDuplicate(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
    throw new ConflictException('A market with this name already exists');
  }

  throw error;
}

@Injectable()
export class MarketRepository implements IMarketRepository {
  constructor(private readonly db: Database) {}

  async create(params: CreateMarketParams): Promise<MarketEntity> {
    try {
      return toMarket(
        await this.db.client.stockMarket.create({
          data: {
            name: params.name,
            neighborhood: params.neighborhood,
            owner: params.owner as OwnerType,
            owner_id: params.ownerId,
          },
        }),
      );
    } catch (error) {
      return rethrowDuplicate(error);
    }
  }

  async deleteByOwner(access: OwnerAccess): Promise<void> {
    await this.db.client.stockMarket.deleteMany({
      where: { owner: access.owner as OwnerType, owner_id: access.ownerId },
    });
  }

  async findById(id: string): Promise<MarketEntity | undefined> {
    const raw = await this.db.client.stockMarket.findUnique({ where: { id } });

    return raw ? toMarket(raw) : undefined;
  }

  async findByOwners(owners: OwnerAccess[], includeArchived: boolean): Promise<MarketEntity[]> {
    const raw = await this.db.client.stockMarket.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      where: {
        ...toOwnerWhere(owners),
        ...(includeArchived ? {} : { status: AccountStatus.ACTIVE }),
      },
    });

    return raw.map(toMarket);
  }

  async update(params: UpdateMarketParams): Promise<MarketEntity> {
    try {
      return toMarket(
        await this.db.client.stockMarket.update({
          data: {
            name: params.name,
            neighborhood: params.neighborhood,
            status: params.status as AccountStatus | undefined,
          },
          where: { id: params.id },
        }),
      );
    } catch (error) {
      return rethrowDuplicate(error);
    }
  }
}
