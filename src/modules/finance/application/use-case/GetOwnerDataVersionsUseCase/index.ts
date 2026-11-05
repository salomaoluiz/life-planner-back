import { Inject } from '@nestjs/common';

import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { IFinanceOwnerVersionRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

// Spec 092: the data version of each owner, in order. The caller has already authorized the owners.
export class GetOwnerDataVersionsUseCase implements UseCaseWithParams<OwnerAccess[], number[]> {
  constructor(
    @Inject('IFinanceOwnerVersionRepository')
    private readonly ownerVersionRepository: IFinanceOwnerVersionRepository,
  ) {}

  async execute(owners: OwnerAccess[]): Promise<number[]> {
    return this.ownerVersionRepository.findVersions(owners);
  }
}
