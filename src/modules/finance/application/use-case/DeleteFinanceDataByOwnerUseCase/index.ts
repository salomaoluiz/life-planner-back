import { Inject } from '@nestjs/common';

import {
  DeleteFinanceDataByOwnerInput,
  DeleteFinanceDataByOwnerSchema,
} from '@finance/application/dto/DeleteFinanceDataByOwner';
import { IFinanceOwnerDataRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Account deletion: purges everything one owner (a user or a family) holds in finance. Idempotent; returns rows deleted.
export class DeleteFinanceDataByOwnerUseCase implements UseCaseWithParams<
  DeleteFinanceDataByOwnerInput,
  number
> {
  constructor(
    @Inject('IFinanceOwnerDataRepository')
    private readonly ownerDataRepository: IFinanceOwnerDataRepository,
  ) {}

  async execute(params: DeleteFinanceDataByOwnerInput): Promise<number> {
    const input = validate(DeleteFinanceDataByOwnerSchema, params);

    return this.ownerDataRepository.deleteAllByOwner(input);
  }
}
