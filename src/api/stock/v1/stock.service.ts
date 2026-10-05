import { Injectable } from '@nestjs/common';

import {
  CreateStockItemApiInput,
  StockItemOutput,
  UpdateStockItemApiInput,
} from '@api/stock/v1/dto/stock.dto';
import { GetUserFamilyIdsUseCase } from '@family/application/use-case/GetUserFamilyIdsUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { CreateStockItemUseCase } from '@stock/application/use-case/CreateStockItemUseCase';
import { DeleteStockItemUseCase } from '@stock/application/use-case/DeleteStockItemUseCase';
import { GetStockItemByIdUseCase } from '@stock/application/use-case/GetStockItemByIdUseCase';
import { GetStockItemsUseCase } from '@stock/application/use-case/GetStockItemsUseCase';
import { UpdateStockItemUseCase } from '@stock/application/use-case/UpdateStockItemUseCase';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockEntity from '@stock/domain/entity/StockEntity';

function toStockItemOutput(item: StockEntity): StockItemOutput {
  return {
    barcode: item.barcode ?? null,
    brand: item.brand ?? null,
    createdAt: item.createdAt.toISOString(),
    description: item.description,
    expirationDate: item.expirationDate?.toISOString() ?? null,
    id: item.id,
    notes: item.notes ?? null,
    openingDate: item.openingDate?.toISOString() ?? null,
    owner: item.owner,
    ownerId: item.ownerId,
    purchaseDate: item.purchaseDate?.toISOString() ?? null,
    quantity: item.quantity,
    unit: item.unit,
    updatedAt: item.updatedAt.toISOString(),
  };
}

@Injectable()
export class StockService {
  constructor(
    private readonly createStockItemUseCase: CreateStockItemUseCase,
    private readonly deleteStockItemUseCase: DeleteStockItemUseCase,
    private readonly getStockItemByIdUseCase: GetStockItemByIdUseCase,
    private readonly getStockItemsUseCase: GetStockItemsUseCase,
    private readonly getUserFamilyIdsUseCase: GetUserFamilyIdsUseCase,
    private readonly updateStockItemUseCase: UpdateStockItemUseCase,
  ) {}

  async create(userId: string, input: CreateStockItemApiInput): Promise<StockItemOutput> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    const item = await this.createStockItemUseCase.execute({ ...input, accessibleOwners });

    return toStockItemOutput(item);
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    await this.deleteStockItemUseCase.execute({ accessibleOwners, id });
  }

  async findAll(userId: string, ownerId?: string): Promise<StockItemOutput[]> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    const items = await this.getStockItemsUseCase.execute({ accessibleOwners, ownerId });

    return items.map((item) => toStockItemOutput(item));
  }

  async findById(userId: string, id: string): Promise<StockItemOutput> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    const item = await this.getStockItemByIdUseCase.execute({ accessibleOwners, id });

    return toStockItemOutput(item);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateStockItemApiInput,
  ): Promise<StockItemOutput> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    const item = await this.updateStockItemUseCase.execute({ ...input, accessibleOwners, id });

    return toStockItemOutput(item);
  }

  // Resolved on every request: the caller plus every family they own or joined (spec 005, C1).
  private async getAccessibleOwners(userId: string): Promise<OwnerAccess[]> {
    const familyIds = await this.getUserFamilyIdsUseCase.execute(userId);

    return [
      { owner: OwnerType.USER, ownerId: userId },
      ...familyIds.map((ownerId) => ({ owner: OwnerType.FAMILY, ownerId })),
    ];
  }
}
