import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { DeleteUserInput, DeleteUserSchema } from '@user/application/dto/DeleteUser';
import { IUserRepository } from '@user/domain/repository';

// Idempotent: deleting a user that is already gone is not an error (a retry after a partial failure must finish the job).
export class DeleteUserUseCase implements UseCaseWithParams<DeleteUserInput, void> {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(params: DeleteUserInput): Promise<void> {
    const input = validate(DeleteUserSchema, params);

    await this.userRepository.deleteUser(input.id);
  }
}
