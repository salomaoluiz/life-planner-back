import { Injectable } from '@nestjs/common';

import { FindMeOutput } from '@api/user/v1/dto/find-me.dto';
import { FindUserByIdOutput } from '@api/user/v1/dto/find-user-by-id.dto';
import { UpdateUserInput, UpdateUserOutput } from '@api/user/v1/dto/update-user.dto';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';
import { UpdateUserUseCase } from '@user/application/use-case/UpdateUserUseCase';

@Injectable()
export class UserService {
  constructor(
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly getUserFamiliesUseCase: GetUserFamiliesUseCase,
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

  async findMe(userId: string): Promise<FindMeOutput> {
    const [user, families] = await Promise.all([
      this.findById(userId),
      this.getUserFamiliesUseCase.execute({ userId }),
    ]);

    return {
      ...user,
      families: families.map((family) => ({
        id: family.id,
        name: family.name,
        status: family.status,
      })),
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
