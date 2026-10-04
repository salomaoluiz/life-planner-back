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
    const input = validate(SignUpByEmailSchema, params);
    const exists = await this.userRepository.getUserByEmail(input.email);

    if (exists) {
      throw new UnprocessableEntityException('Email already in use');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = new UserEntity({
      email: input.email,
      name: input.name,
      passwordHash,
      photoUrl: input.photoURL,
    });

    await this.userRepository.createUser(user);

    return {
      id: user.id,
    };
  }
}
