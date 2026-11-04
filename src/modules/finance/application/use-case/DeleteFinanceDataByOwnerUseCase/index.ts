import { Inject } from '@nestjs/common';

import {
  DeleteFinanceDataByOwnerInput,
  DeleteFinanceDataByOwnerSchema,
} from '@finance/application/dto/DeleteFinanceDataByOwner';
import { MaterializationGate } from '@finance/application/service/MaterializationGate';
import { IFinanceOwnerDataRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Account deletion: purges everything one owner (a user or a family) holds in finance. Idempotent; returns rows deleted.
export class DeleteFinanceDataByOwnerUseCase implements UseCaseWithParams<
  DeleteFinanceDataByOwnerInput,
  number
> {
  constructor(
    @Inject(MaterializationGate)
    private readonly materializationGate: MaterializationGate,
    @Inject('IFinanceOwnerDataRepository')
    private readonly ownerDataRepository: IFinanceOwnerDataRepository,
  ) {}

  async execute(params: DeleteFinanceDataByOwnerInput): Promise<number> {
    const input = validate(DeleteFinanceDataByOwnerSchema, params);

    const deleted = await this.ownerDataRepository.deleteAllByOwner(input);

    this.materializationGate.invalidate([input.ownerId]);

    return deleted;
  }
}
