import { ConflictException, Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  CreateShoppingListInput,
  CreateShoppingListSchema,
} from '@stock/application/dto/ShoppingList';
import { ensureCatalogWritable } from '@stock/application/service/CatalogAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import { IShoppingListRepository } from '@stock/domain/repository';
import { defaultListName } from '@stock/domain/service/DefaultListName';

export class CreateShoppingListUseCase implements UseCaseWithParams<
  CreateShoppingListInput,
  ShoppingListEntity
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
  ) {}

  async execute(params: CreateShoppingListInput): Promise<ShoppingListEntity> {
    const input = validate(CreateShoppingListSchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    ensureCatalogWritable(input.accessibleOwners, target);
    // The owner always has its default first, so the name check below sees it.
    await this.listRepository.ensureDefault(target, defaultListName(input.language));

    const lists = await this.listRepository.findByOwners([target], false);

    if (lists.some((list) => list.name.toLowerCase() === input.name.toLowerCase())) {
      throw new ConflictException('A list with this name already exists');
    }

    return this.listRepository.create({
      currency: input.currency,
      isDefault: input.isDefault,
      name: input.name,
      owner: input.owner,
      ownerId: input.ownerId,
    });
  }
}
