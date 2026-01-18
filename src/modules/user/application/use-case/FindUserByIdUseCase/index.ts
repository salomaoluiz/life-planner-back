import { Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { FindByIdInput, FindByIdOutput } from '@user/application/dto/FindById';
import { IUserRepository } from '@user/domain/repository';

export class FindUserByIdUseCase implements UseCaseWithParams<FindByIdInput, FindByIdOutput> {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(params: FindByIdInput): Promise<FindByIdOutput> {
    const user = await this.userRepository.getUserById(params.id);

    if (!user) {
      throw new NotFoundException();
    }

    return {
      email: user.email,
      id: user.id,
      name: user.name,
      photoUrl: user.photoUrl,
    };
  }
}
