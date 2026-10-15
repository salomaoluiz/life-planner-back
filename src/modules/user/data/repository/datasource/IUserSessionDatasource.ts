import { UserSession } from '@db/client';

export interface IUserSessionDatasource {
  create(session: UserSession): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteByTokenHash(hash: string): Promise<void>;
  deleteExpired(lastUsedBefore: Date): Promise<number>;
  findByTokenHash(hash: string): Promise<null | UserSession>;
  rotate(expectedTokenHash: string, session: UserSession): Promise<boolean>;
}
