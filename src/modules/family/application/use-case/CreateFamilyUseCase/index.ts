import { Inject } from '@nestjs/common';

import { CreateFamilyInput, CreateFamilySchema } from '@family/application/dto/CreateFamily';
import {
  FamilyUseCaseOutput,
  toFamilyUseCaseOutput,
} from '@family/application/dto/FamilyUseCaseOutput';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class CreateFamilyUseCase implements UseCaseWithParams<
  CreateFamilyInput,
  FamilyUseCaseOutput
> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(params: CreateFamilyInput): Promise<FamilyUseCaseOutput> {
    const input = validate(CreateFamilySchema, params);

    const family = await this.familyRepository.createFamily({
      name: input.name,
      ownerEmail: input.ownerEmail,
      ownerId: input.ownerId,
    });

    return toFamilyUseCaseOutput(family);
  }
}
