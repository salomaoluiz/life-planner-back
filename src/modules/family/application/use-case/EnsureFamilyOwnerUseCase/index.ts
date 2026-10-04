import { ForbiddenException, Inject } from '@nestjs/common';

import { FamilyAccessInput } from '@family/application/dto/FamilyAccess';
import { FamilyUseCaseOutput } from '@family/application/dto/FamilyUseCaseOutput';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class EnsureFamilyOwnerUseCase implements UseCaseWithParams<
  FamilyAccessInput,
  FamilyUseCaseOutput
> {
  constructor(
    @Inject(GetFamilyByIdUseCase) private readonly getFamilyByIdUseCase: GetFamilyByIdUseCase,
  ) {}

  async execute(params: FamilyAccessInput): Promise<FamilyUseCaseOutput> {
    // Throws NotFoundException first for non-members (404 before 403).
    const family = await this.getFamilyByIdUseCase.execute(params);

    if (family.ownerId !== params.userId) {
      throw new ForbiddenException();
    }

    return family;
  }
}
