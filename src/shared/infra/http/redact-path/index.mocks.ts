import { redactSensitivePath } from './index';

// region Mocks

const tokenMock = 'q3Jx0b9S2v1mA8kQ7rT4yU6pL5nW0zE3cF2hD1gB9aI';

// endregion Mocks

// region Spies

// endregion Spies

const mocks = { token: tokenMock };

const spies = {};

const setup = redactSensitivePath;

export { mocks, setup, spies };
