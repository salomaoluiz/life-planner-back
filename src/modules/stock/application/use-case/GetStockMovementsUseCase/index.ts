import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';
import {
  GetStockMovementsInput,
  GetStockMovementsSchema,
} from '@stock/application/dto/StockMovement';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockMovementEntity from '@stock/domain/entity/StockMovementEntity';
import { IStockRepository } from '@stock/domain/repository';
import {
  decodeMovementCursor,
  encodeMovementCursor,
  MOVEMENT_PAGE_SIZE,
} from '@stock/domain/service/MovementCursor';

export interface StockMovementsPage {
  items: StockMovementEntity[];
  nextCursor: null | string;
  // The owner of the item, so the API can tell who is still a member without reading the item again.
  owner: { owner: OwnerType; ownerId: string };
}

// Spec 116 FR 11: newest first, 30 per page, keyset cursor.
export class GetStockMovementsUseCase implements UseCaseWithParams<
  GetStockMovementsInput,
  StockMovementsPage
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: GetStockMovementsInput): Promise<StockMovementsPage> {
    const input = validate(GetStockMovementsSchema, params);
    const item = await this.stockRepository.findById(input.itemId);

    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    const cursor = input.cursor === undefined ? undefined : decodeMovementCursor(input.cursor);

    if (input.cursor !== undefined && !cursor) {
      throw new BadRequestException('Invalid cursor');
    }

    const rows = await this.stockRepository.findMovements(
      input.itemId,
      MOVEMENT_PAGE_SIZE + 1,
      cursor,
    );
    const items = rows.slice(0, MOVEMENT_PAGE_SIZE);
    const last = items[items.length - 1];

    return {
      items,
      nextCursor:
        rows.length > MOVEMENT_PAGE_SIZE && last
          ? encodeMovementCursor({ createdAt: last.createdAt, id: last.id })
          : null,
      owner: { owner: item.owner, ownerId: item.ownerId },
    };
  }
}
