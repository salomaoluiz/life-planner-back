import { Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { UpdateUserInput, UpdateUserOutput } from '@user/application/dto/UpdateUser';
import UserEntity from '@user/domain/entity/UserEntity';
import { IUserRepository } from '@user/domain/repository';

export class UpdateUserUseCase implements UseCaseWithParams<UpdateUserInput, UpdateUserOutput> {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(params: UpdateUserInput): Promise<UpdateUserOutput> {
    const { email, id, name, photoUrl } = params;
    const user = await this.userRepository.getUserById(id);

    if (!user) {
      throw new NotFoundException();
    }

    const userToUpdate = new UserEntity({
      email: email ?? user.email,
      id,
      name: name ?? user.name,
      passwordHash: user.passwordHash,
      photoUrl: photoUrl ?? user.photoUrl,
    });

    const updatedUser = await this.userRepository.updateUser(userToUpdate);

    return {
      email: updatedUser.email,
      id: updatedUser.id,
      name: updatedUser.name,
      photoUrl: updatedUser.photoUrl,
    };
  }
}
