import { UserSession } from '@db/client';
import UserSessionEntity from '@user/domain/entity/UserSessionEntity';

export class UserSessionMapper {
  static toDomain(raw: UserSession): UserSessionEntity {
    return new UserSessionEntity({
      createdAt: raw.created_at,
      deviceName: raw.device_name ?? undefined,
      id: raw.id,
      lastUsedAt: raw.last_used_at,
      previousTokenHash: raw.previous_token_hash ?? undefined,
      retiredTokenHash: raw.retired_token_hash ?? undefined,
      rotatedAt: raw.rotated_at ?? undefined,
      tokenHash: raw.token_hash,
      userId: raw.user_id,
    });
  }

  static toPersistence(raw: UserSessionEntity): UserSession {
    return {
      created_at: raw.createdAt,
      device_name: raw.deviceName ?? null,
      id: raw.id,
      last_used_at: raw.lastUsedAt,
      previous_token_hash: raw.previousTokenHash ?? null,
      retired_token_hash: raw.retiredTokenHash ?? null,
      rotated_at: raw.rotatedAt ?? null,
      token_hash: raw.tokenHash,
      user_id: raw.userId,
    };
  }
}
