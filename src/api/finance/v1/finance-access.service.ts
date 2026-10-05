import { Injectable } from '@nestjs/common';

import { GetUserFamilyIdsUseCase } from '@family/application/use-case/GetUserFamilyIdsUseCase';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// The finance use cases never call the family module: this service resolves, once per request,
// the owners the caller can act on (themself + every family they own or joined).
@Injectable()
export class FinanceAccessService {
  constructor(private readonly getUserFamilyIdsUseCase: GetUserFamilyIdsUseCase) {}

  async resolve(userId: string): Promise<OwnerAccess[]> {
    const familyIds = await this.getUserFamilyIdsUseCase.execute(userId);

    return [
      { owner: OwnerType.USER, ownerId: userId },
      ...familyIds.map((ownerId) => ({ owner: OwnerType.FAMILY, ownerId })),
    ];
  }
}
