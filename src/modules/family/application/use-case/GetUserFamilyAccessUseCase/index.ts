import { Inject } from '@nestjs/common';

import { FamilyStatus } from '@family/domain/enum';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface FamilyAccess {
  archived: boolean;
  familyId: string;
}

// Spec 042: the families the user belongs to with their archived flag, resolved once per request.
export class GetUserFamilyAccessUseCase implements UseCaseWithParams<string, FamilyAccess[]> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(userId: string): Promise<FamilyAccess[]> {
    const families = await this.familyRepository.getFamilies(userId);

    return families.map((family) => ({
      archived: family.status === FamilyStatus.ARCHIVED,
      familyId: family.id,
    }));
  }
}
