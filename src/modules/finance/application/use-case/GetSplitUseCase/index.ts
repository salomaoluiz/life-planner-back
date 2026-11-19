import { Inject, NotFoundException } from '@nestjs/common';

import { SplitAccessInput, SplitAccessSchema } from '@finance/application/dto/SplitAccess';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import SplitEntity from '@finance/domain/entity/SplitEntity';
import { IFinanceSplitRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 119 FR 32: the whole split for the form; 404 when it is missing or the caller can't read its owner.
export class GetSplitUseCase implements UseCaseWithParams<SplitAccessInput, SplitEntity> {
  constructor(
    @Inject('IFinanceSplitRepository')
    private readonly splitRepository: IFinanceSplitRepository,
  ) {}

  async execute(params: SplitAccessInput): Promise<SplitEntity> {
    const input = validate(SplitAccessSchema, params);
    const split = await this.splitRepository.findSplitById(input.id);

    if (!split || !hasOwnerAccess(input.accessibleOwners, split)) {
      throw new NotFoundException('Split not found');
    }

    return split;
  }
}
