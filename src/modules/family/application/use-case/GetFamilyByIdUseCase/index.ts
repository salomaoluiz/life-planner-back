import { Inject, NotFoundException } from '@nestjs/common';

import { FamilyAccessInput } from '@family/application/dto/FamilyAccess';
import {
  FamilyUseCaseOutput,
  toFamilyUseCaseOutput,
} from '@family/application/dto/FamilyUseCaseOutput';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class GetFamilyByIdUseCase implements UseCaseWithParams<
  FamilyAccessInput,
  FamilyUseCaseOutput
> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(params: FamilyAccessInput): Promise<FamilyUseCaseOutput> {
    // Non-members get 404 so the existence of the family is never revealed.
    const isMember = await this.familyRepository.isFamilyMember({
      familyId: params.familyId,
      userId: params.userId,
    });

    if (!isMember) {
      throw new NotFoundException();
    }

    const family = await this.familyRepository.getFamilyById(params.familyId);

    if (!family) {
      throw new NotFoundException();
    }

    return toFamilyUseCaseOutput(family);
  }
}
