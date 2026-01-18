import { Inject, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  SignUpByEmailInput,
  SignUpByEmailOutput,
  SignUpByEmailSchema,
} from '@user/application/dto/SignUpByEmail';
import UserEntity from '@user/domain/entity/UserEntity';
import { IUserRepository } from '@user/domain/repository';
import { IPasswordHasherRepository } from '@user/domain/repository/IPasswordHasherRepository';

export class SignUpByEmailUseCase implements UseCaseWithParams<
  SignUpByEmailInput,
  SignUpByEmailOutput
> {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    @Inject('IPasswordHasherRepository') private readonly passwordHasher: IPasswordHasherRepository,
  ) {}

  async execute(params: SignUpByEmailInput): Promise<SignUpByEmailOutput> {
    validate(SignUpByEmailSchema, params);
    const exists = await this.userRepository.getUserByEmail(params.email);

    if (exists) {
      throw new UnprocessableEntityException('Invalid credentials');
    }

    const passwordHash = await this.passwordHasher.hash(params.password);

    const user = new UserEntity({
      email: params.email,
      name: params.name,
      passwordHash,
      photoUrl: params.photoURL,
    });

    await this.userRepository.createUser(user);

    return {
      id: user.id,
    };
  }
}
