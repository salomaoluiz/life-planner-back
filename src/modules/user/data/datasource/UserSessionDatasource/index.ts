import { Injectable } from '@nestjs/common';

import { UserSession } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import { IUserSessionDatasource } from '@user/data/repository/datasource/IUserSessionDatasource';

function anyHash(hash: string) {
  return {
    OR: [{ token_hash: hash }, { previous_token_hash: hash }, { retired_token_hash: hash }],
  };
}

@Injectable()
export class UserSessionDatasource implements IUserSessionDatasource {
  constructor(private readonly db: Database) {}

  async create(session: UserSession): Promise<void> {
    await this.db.client.userSession.create({ data: session });
  }

  async deleteById(id: string): Promise<void> {
    await this.db.client.userSession.deleteMany({ where: { id } });
  }

  async deleteByTokenHash(hash: string): Promise<void> {
    await this.db.client.userSession.deleteMany({ where: anyHash(hash) });
  }

  async deleteExpired(lastUsedBefore: Date): Promise<number> {
    const result = await this.db.client.userSession.deleteMany({
      where: { last_used_at: { lt: lastUsedBefore } },
    });

    return result.count;
  }

  async findByTokenHash(hash: string): Promise<null | UserSession> {
    return this.db.client.userSession.findFirst({ where: anyHash(hash) });
  }

  async rotate(expectedTokenHash: string, session: UserSession): Promise<boolean> {
    const result = await this.db.client.userSession.updateMany({
      data: {
        last_used_at: session.last_used_at,
        previous_token_hash: session.previous_token_hash,
        retired_token_hash: session.retired_token_hash,
        rotated_at: session.rotated_at,
        token_hash: session.token_hash,
      },
      where: { id: session.id, token_hash: expectedTokenHash },
    });

    return result.count === 1;
  }
}
