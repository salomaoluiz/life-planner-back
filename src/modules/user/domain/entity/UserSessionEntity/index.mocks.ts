import UserSessionEntity, { IUserSessionEntity } from './index';

function build(overrides: Partial<IUserSessionEntity> = {}) {
  return new UserSessionEntity({ tokenHash: 'hash', userId: 'user-id', ...overrides });
}

const mocks = { build };

export { mocks };
