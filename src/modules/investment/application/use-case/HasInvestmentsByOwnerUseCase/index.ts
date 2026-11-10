import { Inject } from '@nestjs/common';

import { OwnerInput, OwnerSchema } from '@investment/application/dto/AssetAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// "Does this owner still have assets?": used by the family delete guard (409).
export class HasInvestmentsByOwnerUseCase implements UseCaseWithParams<OwnerInput, boolean> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: OwnerInput): Promise<boolean> {
    return this.repository.existsByOwner(validate(OwnerSchema, params));
  }
}
