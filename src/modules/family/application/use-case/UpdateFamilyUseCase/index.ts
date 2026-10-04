import { Inject } from '@nestjs/common';

import {
  FamilyUseCaseOutput,
  toFamilyUseCaseOutput,
} from '@family/application/dto/FamilyUseCaseOutput';
import { UpdateFamilyInput, UpdateFamilySchema } from '@family/application/dto/UpdateFamily';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class UpdateFamilyUseCase implements UseCaseWithParams<
  UpdateFamilyInput,
  FamilyUseCaseOutput
> {
  constructor(
    @Inject(EnsureFamilyOwnerUseCase)
    private readonly ensureFamilyOwnerUseCase: EnsureFamilyOwnerUseCase,
    @Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository,
  ) {}

  async execute(params: UpdateFamilyInput): Promise<FamilyUseCaseOutput> {
    const input = validate(UpdateFamilySchema, params);

    await this.ensureFamilyOwnerUseCase.execute({
      familyId: input.familyId,
      userId: input.userId,
    });

    const family = await this.familyRepository.updateFamily({
      id: input.familyId,
      name: input.name,
    });

    return toFamilyUseCaseOutput(family);
  }
}
