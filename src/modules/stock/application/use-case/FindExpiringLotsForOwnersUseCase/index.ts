import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  FindExpiringLotsForOwnersInput,
  FindExpiringLotsForOwnersSchema,
} from '@stock/application/dto/FindExpiringLotsForOwners';
import { ExpiringLot } from '@stock/domain/entity/ExpiringLot';
import { IStockRepository } from '@stock/domain/repository';

// Spec 124 FR 29: the lots of all the owners of a page of users inside their item's warning window (116 FR 20, the
// rule of the "Vencendo" badge) or already expired, in ONE statement. Archived families are skipped by the caller.
export class FindExpiringLotsForOwnersUseCase implements UseCaseWithParams<
  FindExpiringLotsForOwnersInput,
  ExpiringLot[]
> {
  constructor(@Inject('IStockRepository') private readonly stockRepository: IStockRepository) {}

  async execute(params: FindExpiringLotsForOwnersInput): Promise<ExpiringLot[]> {
    const input = validate(FindExpiringLotsForOwnersSchema, params);

    if (input.owners.length === 0) {
      return [];
    }

    return this.stockRepository.findExpiringLots(input.owners, input.today);
  }
}
