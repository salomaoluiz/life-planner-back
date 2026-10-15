import { Inject, UnauthorizedException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { EnvService } from '@shared/infra/env/env.service';
import { IJwtProvider } from '@shared/infra/jwt/types';
import { generateToken, hashToken } from '@shared/infra/token';
import { validate } from '@shared/infra/validation';
import {
  RefreshSessionInput,
  RefreshSessionOutput,
  RefreshSessionSchema,
} from '@user/application/dto/RefreshSession';
import { IUserRepository, IUserSessionRepository } from '@user/domain/repository';

// One message for every failure: never reveal whether a token is unknown, expired or reused.
const INVALID_SESSION = 'Invalid or expired session';

export class RefreshSessionUseCase implements UseCaseWithParams<
  RefreshSessionInput,
  RefreshSessionOutput
> {
  constructor(
    @Inject('IUserSessionRepository') private readonly sessionRepository: IUserSessionRepository,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    @Inject('IJwtProvider') private readonly jwtProvider: IJwtProvider,
    @Inject(EnvService) private readonly env: EnvService,
  ) {}

  async execute(params: RefreshSessionInput): Promise<RefreshSessionOutput> {
    const input = validate(RefreshSessionSchema, params);
    const presentedHash = hashToken(input.refreshToken);
    const session = await this.sessionRepository.findSessionByTokenHash(presentedHash);

    if (!session) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const now = new Date();
    const ttl = this.env.sessionIdleTtlSeconds;

    // Idle, copied (retired token) or orphaned sessions are dead: remove them and answer 401.
    if (
      session.isIdle(now, ttl) ||
      session.matchesRetired(presentedHash) ||
      !(await this.userRepository.existsById(session.userId))
    ) {
      await this.sessionRepository.deleteSessionById(session.id);
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const refreshToken = generateToken();
    const newHash = hashToken(refreshToken);
    const rotated = session.matchesCurrent(presentedHash)
      ? session.rotate(newHash, now)
      : session.rotateAfterLostResponse(newHash, now);

    // Compare-and-swap on the current hash: a concurrent refresh with the same token loses (401)
    // and the session survives.
    if (!(await this.sessionRepository.rotateSession(session.tokenHash, rotated))) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const token = await this.jwtProvider.sign({ user: { id: session.userId } });

    return { refreshToken, refreshTokenExpiresIn: ttl, token };
  }
}
