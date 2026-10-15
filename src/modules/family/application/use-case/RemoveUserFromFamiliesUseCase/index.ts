import { Inject } from '@nestjs/common';

import {
  RemoveUserFromFamiliesInput,
  RemoveUserFromFamiliesOutput,
  RemoveUserFromFamiliesSchema,
} from '@family/application/dto/RemoveUserFromFamilies';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Bypasses the 409 "family still owns records" guard on purpose: the caller purged those records first.
export class RemoveUserFromFamiliesUseCase implements UseCaseWithParams<
  RemoveUserFromFamiliesInput,
  RemoveUserFromFamiliesOutput
> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(params: RemoveUserFromFamiliesInput): Promise<RemoveUserFromFamiliesOutput> {
    const input = validate(RemoveUserFromFamiliesSchema, params);

    return this.familyRepository.removeUser(input);
  }
}
