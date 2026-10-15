import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { hashToken } from '@shared/infra/token';
import { validate } from '@shared/infra/validation';
import { RevokeSessionInput, RevokeSessionSchema } from '@user/application/dto/RevokeSession';
import { IUserSessionRepository } from '@user/domain/repository';

export class RevokeSessionUseCase implements UseCaseWithParams<RevokeSessionInput, void> {
  constructor(
    @Inject('IUserSessionRepository') private readonly sessionRepository: IUserSessionRepository,
  ) {}

  // Idempotent: an unknown or already expired token is not an error (no information leak, and
  // logout must always work).
  async execute(params: RevokeSessionInput): Promise<void> {
    const input = validate(RevokeSessionSchema, params);

    await this.sessionRepository.deleteSessionByTokenHash(hashToken(input.refreshToken));
  }
}
