import { mocks, setup, spies } from './BcryptHasher.mocks';

describe('hash', () => {
  it('SHOULD hash the password with salt rounds 10', async () => {
    spies.hash.mockResolvedValue(mocks.newHash as never);

    const hasher = setup();
    const result = await hasher.hash(mocks.password);

    expect(result).toBe(mocks.newHash);
    expect(spies.hash).toHaveBeenCalledTimes(1);
    expect(spies.hash).toHaveBeenCalledWith(mocks.password, 10);
  });
});

describe('compare', () => {
  it('SHOULD compare the password with the hash using bcrypt', async () => {
    spies.compare.mockResolvedValue(mocks.compareResult as never);

    const hasher = setup();
    const result = await hasher.compare(mocks.password, mocks.hashedPassword);

    expect(result).toBe(mocks.compareResult);
    expect(spies.compare).toHaveBeenCalledTimes(1);
    expect(spies.compare).toHaveBeenCalledWith(mocks.password, mocks.hashedPassword);
  });
});
