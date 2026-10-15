import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { IUserRepository } from '@user/domain/repository';

// Used by the JwtAuthGuard (through USER_EXISTS_CHECK): one primary-key lookup per authenticated request.
export class UserExistsUseCase implements UseCaseWithParams<string, boolean> {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<boolean> {
    return this.userRepository.existsById(userId);
  }
}
