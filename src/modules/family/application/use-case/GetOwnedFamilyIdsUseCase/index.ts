import { Inject } from '@nestjs/common';

import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class GetOwnedFamilyIdsUseCase implements UseCaseWithParams<string, string[]> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(userId: string): Promise<string[]> {
    return this.familyRepository.getOwnedFamilyIds(userId);
  }
}
