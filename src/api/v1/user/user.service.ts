import { Injectable } from '@nestjs/common';

import { FindUserByIdOutput } from '@api/v1/user/dto/find-user-by-id.dto';
import { UpdateUserInput, UpdateUserOutput } from '@api/v1/user/dto/update-user.dto';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';
import { UpdateUserUseCase } from '@user/application/use-case/UpdateUserUseCase';

@Injectable()
export class UserService {
  constructor(
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
  ) {}

  async findById(id: string): Promise<FindUserByIdOutput> {
    const user = await this.findUserByIdUseCase.execute({ id });

    return {
      email: user.email,
      id: user.id,
      name: user.name,
      photoUrl: user.photoUrl,
    };
  }

  async update(id: string, updateUserDto: UpdateUserInput): Promise<UpdateUserOutput> {
    const updatedUser = await this.updateUserUseCase.execute({
      email: updateUserDto.email,
      id,
      name: updateUserDto.name,
      photoUrl: updateUserDto.photoUrl,
    });

    return {
      email: updatedUser.email,
      id: updatedUser.id,
      name: updatedUser.name,
      photoUrl: updatedUser.photoUrl,
    };
  }
}
