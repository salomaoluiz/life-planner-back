import { Inject } from '@nestjs/common';

import { OwnerInput, OwnerSchema } from '@investment/application/dto/AssetAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Account deletion (spec 024): purges the user's assets with their operations, fees, valuations and linked rows.
// Idempotent; returns the assets deleted.
export class DeleteInvestmentsByOwnerUseCase implements UseCaseWithParams<OwnerInput, number> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: OwnerInput): Promise<number> {
    return this.repository.deleteAssetsByOwner(validate(OwnerSchema, params));
  }
}
