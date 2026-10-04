import { Inject } from '@nestjs/common';

import { FamilyAccessInput } from '@family/application/dto/FamilyAccess';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class DeleteFamilyUseCase implements UseCaseWithParams<FamilyAccessInput, void> {
  constructor(
    @Inject(EnsureFamilyOwnerUseCase)
    private readonly ensureFamilyOwnerUseCase: EnsureFamilyOwnerUseCase,
    @Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository,
  ) {}

  async execute(params: FamilyAccessInput): Promise<void> {
    await this.ensureFamilyOwnerUseCase.execute(params);

    // Memberships are removed by the ON DELETE CASCADE FK.
    await this.familyRepository.deleteFamily(params.familyId);
  }
}
