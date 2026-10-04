import { Inject } from '@nestjs/common';

import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class GetUserFamilyIdsUseCase implements UseCaseWithParams<string, string[]> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(userId: string): Promise<string[]> {
    const families = await this.familyRepository.getFamilies(userId);

    return families.map((family) => family.id);
  }
}
