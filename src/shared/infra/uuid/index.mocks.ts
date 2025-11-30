import { faker } from '@faker-js/faker';
import { v4, v5 } from 'uuid';

import { uuidV4, uuidV5 } from './index';

// region Mocks
jest.mock('uuid');

const uuidV4Mock = Uint8Array.from(faker.string.uuid());
const uuidV5Mock = Uint8Array.from(faker.string.uuid());

// endregion Mocks

// region Spies

const v4Spy = jest.mocked(v4).mockReturnValue(uuidV4Mock);
const v5Spy = jest.mocked(v5).mockReturnValue(uuidV5Mock);

// endregion Spies

const mocks = {
  uuidV4: uuidV4Mock,
  uuidV5: uuidV5Mock,
};

const spies = {
  v4: v4Spy,
  v5: v5Spy,
};

const setup = {
  uuidV4,
  uuidV5,
};

export { mocks, setup, spies };
