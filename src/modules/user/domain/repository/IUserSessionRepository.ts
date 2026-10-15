import UserSessionEntity from '@user/domain/entity/UserSessionEntity';

export type IUserSessionRepository = {
  createSession(session: UserSessionEntity): Promise<void>;
  deleteExpiredSessions(lastUsedBefore: Date): Promise<number>;
  deleteSessionById(id: string): Promise<void>;
  // Matches the current, previous or retired hash.
  deleteSessionByTokenHash(hash: string): Promise<void>;
  // Matches the current, previous or retired hash.
  findSessionByTokenHash(hash: string): Promise<undefined | UserSessionEntity>;
  // Compare-and-swap on the current hash; false means another request rotated first.
  rotateSession(expectedTokenHash: string, session: UserSessionEntity): Promise<boolean>;
};
