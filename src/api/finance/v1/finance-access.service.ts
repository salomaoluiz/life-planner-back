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
    const families = await this.getUserFamilyAccessUseCase.execute(userId);

    return [
      { owner: OwnerType.USER, ownerId: userId },
      ...families.map(({ archived, familyId }) => ({
        archived,
        owner: OwnerType.FAMILY,
        ownerId: familyId,
      })),
    ];
  }
}
