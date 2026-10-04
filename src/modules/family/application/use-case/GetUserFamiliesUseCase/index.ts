import { Inject } from '@nestjs/common';

import {
  FamilyUseCaseOutput,
  toFamilyUseCaseOutput,
} from '@family/application/dto/FamilyUseCaseOutput';
import FamilyEntity from '@family/domain/entity/FamilyEntity';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class GetUserFamiliesUseCase implements UseCaseWithParams<
  { userId: string },
  FamilyUseCaseOutput[]
> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(params: { userId: string }): Promise<FamilyUseCaseOutput[]> {
    const families = await this.familyRepository.getFamilies(params.userId);

    return [...families].sort(compareFamilies).map((family) => toFamilyUseCaseOutput(family));
  }
}

function compareFamilies(a: FamilyEntity, b: FamilyEntity): number {
  const nameA = a.name.toLowerCase();
  const nameB = b.name.toLowerCase();

  if (nameA !== nameB) {
    return nameA < nameB ? -1 : 1;
  }

  return a.createdAt.getTime() - b.createdAt.getTime();
}
