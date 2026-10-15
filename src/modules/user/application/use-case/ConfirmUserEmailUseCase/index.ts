import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  ConfirmUserEmailInput,
  ConfirmUserEmailOutput,
  ConfirmUserEmailSchema,
} from '@user/application/dto/ConfirmUserEmail';
import { IUserRepository } from '@user/domain/repository';

// The email is only a confirmation checked against the stored email of the token user. The user is never looked up by it.
export class ConfirmUserEmailUseCase implements UseCaseWithParams<
  ConfirmUserEmailInput,
  ConfirmUserEmailOutput
> {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(params: ConfirmUserEmailInput): Promise<ConfirmUserEmailOutput> {
    const input = validate(ConfirmUserEmailSchema, params);
    const user = await this.userRepository.getUserById(input.id);

    if (!user) {
      throw new NotFoundException();
    }

    if (user.email.trim().toLowerCase() !== input.email) {
      throw new UnprocessableEntityException('Email does not match');
    }

    return { email: user.email };
  }
}
