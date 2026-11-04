import { Injectable } from '@nestjs/common';

import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// The finance use cases never call the family module: this service resolves, once per request,
// the owners the caller can act on (themself + every family they own or joined).
@Injectable()
export class FinanceAccessService {
  constructor(private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase) {}

  async resolve(userId: string): Promise<OwnerAccess[]> {
    return (await this.resolveWithNames(userId)).accessibleOwners;
  }

  // Spec 083: the family names come from the same read, for callers that print them (CSV export).
  async resolveWithNames(
    userId: string,
  ): Promise<{ accessibleOwners: OwnerAccess[]; familyNames: Record<string, string> }> {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);

    return {
      accessibleOwners: [
        { owner: OwnerType.USER, ownerId: userId },
        ...families.map(({ archived, familyId }) => ({
          archived,
          owner: OwnerType.FAMILY,
          ownerId: familyId,
        })),
      ],
      familyNames: Object.fromEntries(families.map(({ familyId, name }) => [familyId, name])),
    };
  }
}
