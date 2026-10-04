import { Inject } from '@nestjs/common';

import { FamilyAccessInput } from '@family/application/dto/FamilyAccess';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class CheckFamilyMembershipUseCase implements UseCaseWithParams<FamilyAccessInput, boolean> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(params: FamilyAccessInput): Promise<boolean> {
    return this.familyRepository.isFamilyMember({
      familyId: params.familyId,
      userId: params.userId,
    });
  }
}
