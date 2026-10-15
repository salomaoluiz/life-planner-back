import { Inject } from '@nestjs/common';

import { UseCase } from '@shared/application/use-case/types';
import { EnvService } from '@shared/infra/env/env.service';
import { IUserSessionRepository } from '@user/domain/repository';

export class PurgeExpiredSessionsUseCase implements UseCase<number> {
  constructor(
    @Inject('IUserSessionRepository') private readonly sessionRepository: IUserSessionRepository,
    @Inject(EnvService) private readonly env: EnvService,
  ) {}

  // Sessions of any user idle for longer than the TTL can no longer be refreshed: drop them.
  async execute(): Promise<number> {
    const cutoff = new Date(Date.now() - this.env.sessionIdleTtlSeconds * 1000);

    return this.sessionRepository.deleteExpiredSessions(cutoff);
  }
}
