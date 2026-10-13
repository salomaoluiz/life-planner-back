import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { FindUsersByIdsInput, FindUsersByIdsOutput } from '@user/application/dto/FindUsersByIds';
import { IUserRepository } from '@user/domain/repository';

export class FindUsersByIdsUseCase implements UseCaseWithParams<
  FindUsersByIdsInput,
  FindUsersByIdsOutput
> {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(params: FindUsersByIdsInput): Promise<FindUsersByIdsOutput> {
    const ids = [...new Set(params.ids)];

    if (ids.length === 0) {
      return [];
    }

    const users = await this.userRepository.getUsersByIds(ids);

    // Explicit projection: the password hash must never leave the user module.
    return users.map((user) => ({
      email: user.email,
      id: user.id,
      name: user.name,
      photoUrl: user.photoUrl,
    }));
  }
}
