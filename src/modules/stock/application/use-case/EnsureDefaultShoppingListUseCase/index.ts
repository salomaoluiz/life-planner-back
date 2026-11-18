import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import { IShoppingListRepository } from '@stock/domain/repository';
import { defaultListName } from '@stock/domain/service/DefaultListName';

export interface EnsureDefaultShoppingListInput {
  access: OwnerAccess;
  language?: string;
}

// Spec 118 FR 2: every owner has one active default list, created on demand. An archived family is read-only,
// so its default list is only returned when it already exists.
export class EnsureDefaultShoppingListUseCase implements UseCaseWithParams<
  EnsureDefaultShoppingListInput,
  ShoppingListEntity | undefined
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
  ) {}

  async execute(params: EnsureDefaultShoppingListInput): Promise<ShoppingListEntity | undefined> {
    if (params.access.archived) {
      const lists = await this.listRepository.findByOwners([params.access], false);

      return lists.find((list) => list.isDefault);
    }

    return this.listRepository.ensureDefault(params.access, defaultListName(params.language));
  }
}
