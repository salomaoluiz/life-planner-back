import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  CreateUserInput,
  CreateUserOutput,
  CreateUserSchema,
} from '@user/application/dto/CreateUser';
import UserEntity from '@user/domain/entity/UserEntity';
import { IUserRepository } from '@user/domain/repository';

export class CreateUserUseCase extends UseCaseWithParams<CreateUserInput, CreateUserOutput> {
  constructor(private readonly userRepository: IUserRepository) {
    super();
  }

  async execute(params: CreateUserInput): Promise<CreateUserOutput> {
    validate(CreateUserSchema, params);

    const user = new UserEntity({
      email: params.email,
      name: params.name,
      photoUrl: params.photoURL,
    });

    await this.userRepository.createUser(user);

    return {
      id: user.id,
    };
  }
}
