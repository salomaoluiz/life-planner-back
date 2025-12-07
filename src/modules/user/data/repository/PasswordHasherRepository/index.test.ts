import { mocks, setup } from './index.mocks';

describe('hash', () => {
  it('SHOULD call passwordHasher.hash with correct parameters AND return the hash', async () => {
    mocks.passwordHasher.hash.mockResolvedValue(mocks.newHashedPassword);

    const result = await setup.hash(mocks.password);

    expect(mocks.passwordHasher.hash).toHaveBeenCalledTimes(1);
    expect(mocks.passwordHasher.hash).toHaveBeenCalledWith(mocks.password);
    expect(result).toBe(mocks.newHashedPassword);
  });
});

describe('compare', () => {
  it('SHOULD call passwordHasher.compare with correct parameters AND return true when match', async () => {
    mocks.passwordHasher.compare.mockResolvedValue(true);

    const result = await setup.compare(mocks.password, mocks.hashedPassword);

    expect(mocks.passwordHasher.compare).toHaveBeenCalledTimes(1);
    expect(mocks.passwordHasher.compare).toHaveBeenCalledWith(mocks.password, mocks.hashedPassword);
    expect(result).toBe(true);
  });

  it('SHOULD call passwordHasher.compare with correct parameters AND return false when not match', async () => {
    mocks.passwordHasher.compare.mockResolvedValue(false);

    const result = await setup.compare(mocks.password, mocks.hashedPassword);

    expect(mocks.passwordHasher.compare).toHaveBeenCalledTimes(1);
    expect(mocks.passwordHasher.compare).toHaveBeenCalledWith(mocks.password, mocks.hashedPassword);
    expect(result).toBe(false);
  });
});
