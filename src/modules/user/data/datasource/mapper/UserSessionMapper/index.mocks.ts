import { UserSession } from '@db/client';
import UserSessionEntity from '@user/domain/entity/UserSessionEntity';

const date = new Date('2026-10-15T12:00:00.000Z');

const raw: UserSession = {
  created_at: date,
  device_name: 'iPhone',
  id: 'session-id',
  last_used_at: date,
  previous_token_hash: 'prev',
  retired_token_hash: 'old',
  rotated_at: date,
  token_hash: 'cur',
  user_id: 'user-id',
};

const rawMinimal: UserSession = {
  ...raw,
  device_name: null,
  previous_token_hash: null,
  retired_token_hash: null,
  rotated_at: null,
};

const entity = new UserSessionEntity({
  createdAt: date,
  deviceName: 'iPhone',
  id: 'session-id',
  lastUsedAt: date,
  previousTokenHash: 'prev',
  retiredTokenHash: 'old',
  rotatedAt: date,
  tokenHash: 'cur',
  userId: 'user-id',
});

const mocks = { entity, raw, rawMinimal };

export { mocks };
