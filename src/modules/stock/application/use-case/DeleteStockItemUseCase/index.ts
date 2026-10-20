import { Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  DeleteStockItemInput,
  DeleteStockItemSchema,
} from '@stock/application/dto/DeleteStockItem';
import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { IStockRepository } from '@stock/domain/repository';

export class DeleteStockItemUseCase implements UseCaseWithParams<DeleteStockItemInput, void> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: DeleteStockItemInput): Promise<void> {
    const input = validate(DeleteStockItemSchema, params);

    const item = await this.stockRepository.findById(input.id);

    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, item);

    await this.stockRepository.delete(input.id);
  }
}
