import { Inject, Injectable } from '@nestjs/common';

import { UserSessionMapper } from '@user/data/datasource/mapper/UserSessionMapper';
import { IUserSessionDatasource } from '@user/data/repository/datasource/IUserSessionDatasource';
import UserSessionEntity from '@user/domain/entity/UserSessionEntity';
import { IUserSessionRepository } from '@user/domain/repository';

@Injectable()
export class UserSessionRepository implements IUserSessionRepository {
  constructor(
    @Inject('IUserSessionDatasource') private readonly sessionDatasource: IUserSessionDatasource,
  ) {}

  async createSession(session: UserSessionEntity): Promise<void> {
    await this.sessionDatasource.create(UserSessionMapper.toPersistence(session));
  }

  async deleteExpiredSessions(lastUsedBefore: Date): Promise<number> {
    return this.sessionDatasource.deleteExpired(lastUsedBefore);
  }

  async deleteSessionById(id: string): Promise<void> {
    await this.sessionDatasource.deleteById(id);
  }

  async deleteSessionByTokenHash(hash: string): Promise<void> {
    await this.sessionDatasource.deleteByTokenHash(hash);
  }

  async findSessionByTokenHash(hash: string): Promise<undefined | UserSessionEntity> {
    const result = await this.sessionDatasource.findByTokenHash(hash);

    return result ? UserSessionMapper.toDomain(result) : undefined;
  }

  async rotateSession(expectedTokenHash: string, session: UserSessionEntity): Promise<boolean> {
    return this.sessionDatasource.rotate(
      expectedTokenHash,
      UserSessionMapper.toPersistence(session),
    );
  }
}
