import { generateToken, hashToken, TOKEN_REGEX } from './index';

// region Mocks

// SHA-256("abc"), a published test vector.
const abcHashMock = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

// endregion Mocks

// region Spies

// endregion Spies

const mocks = { abcHash: abcHashMock, tokenRegex: TOKEN_REGEX };

const spies = {};

const setup = { generateToken, hashToken };

export { mocks, setup, spies };
