import { uuidV4 } from '@shared/infra/uuid';

export interface IUserSessionEntity {
  createdAt?: Date;
  deviceName?: string;
  id?: string;
  lastUsedAt?: Date;
  previousTokenHash?: string;
  retiredTokenHash?: string;
  rotatedAt?: Date;
  tokenHash: string;
  userId: string;
}

class UserSessionEntity {
  createdAt: Date;
  deviceName?: string;
  id: string;
  lastUsedAt: Date;
  previousTokenHash?: string;
  retiredTokenHash?: string;
  rotatedAt?: Date;
  tokenHash: string;
  userId: string;

  constructor(props: IUserSessionEntity) {
    this.id = props.id ?? uuidV4();
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
    this.previousTokenHash = props.previousTokenHash;
    this.retiredTokenHash = props.retiredTokenHash;
    this.deviceName = props.deviceName;
    this.createdAt = props.createdAt ?? new Date();
    this.lastUsedAt = props.lastUsedAt ?? this.createdAt;
    this.rotatedAt = props.rotatedAt;
  }

  isIdle(now: Date, idleTtlSeconds: number): boolean {
    return now.getTime() - this.lastUsedAt.getTime() >= idleTtlSeconds * 1000;
  }

  matchesCurrent(hash: string): boolean {
    return this.tokenHash === hash;
  }

  matchesRetired(hash: string): boolean {
    return this.retiredTokenHash === hash;
  }

  // The current token was presented and accepted: the previous one is now superseded for good.
  rotate(newTokenHash: string, now: Date): UserSessionEntity {
    return new UserSessionEntity({
      ...this,
      lastUsedAt: now,
      previousTokenHash: this.tokenHash,
      retiredTokenHash: this.previousTokenHash,
      rotatedAt: now,
      tokenHash: newTokenHash,
    });
  }

  // The previous token was presented while the current one was never used: the client probably never
  // received the current one, so only the current hash is replaced.
  rotateAfterLostResponse(newTokenHash: string, now: Date): UserSessionEntity {
    return new UserSessionEntity({
      ...this,
      lastUsedAt: now,
      rotatedAt: now,
      tokenHash: newTokenHash,
    });
  }
}

export default UserSessionEntity;
