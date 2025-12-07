import { mocks, setup, spies } from './index.mocks';

describe('Method findByEmail', () => {
  it('SHOULD return the user WHEN found', async () => {
    spies.findFirst.mockResolvedValue(mocks.user);

    const result = await setup.findByEmail(mocks.email);

    expect(result).toEqual(mocks.user);
    expect(spies.findFirst).toHaveBeenCalledTimes(1);
    expect(spies.findFirst).toHaveBeenCalledWith({
      where: {
        email: mocks.email,
      },
    });
  });

  it('SHOULD return null WHEN user is NOT found', async () => {
    spies.findFirst.mockResolvedValue(null);

    const result = await setup.findByEmail(mocks.email);

    expect(result).toBeNull();
    expect(spies.findFirst).toHaveBeenCalledTimes(1);
    expect(spies.findFirst).toHaveBeenCalledWith({
      where: {
        email: mocks.email,
      },
    });
  });
});

describe('Method findById', () => {
  it('SHOULD return the user WHEN found', async () => {
    spies.findUnique.mockResolvedValue(mocks.user);

    const result = await setup.findById(mocks.id);

    expect(result).toEqual(mocks.user);
    expect(spies.findUnique).toHaveBeenCalledTimes(1);
    expect(spies.findUnique).toHaveBeenCalledWith({
      where: {
        id: mocks.id,
      },
    });
  });

  it('SHOULD return null WHEN user is NOT found', async () => {
    spies.findUnique.mockResolvedValue(null);

    const result = await setup.findById(mocks.id);

    expect(result).toBeNull();
    expect(spies.findUnique).toHaveBeenCalledTimes(1);
    expect(spies.findUnique).toHaveBeenCalledWith({
      where: {
        id: mocks.id,
      },
    });
  });
});

describe('Method save', () => {
  it('SHOULD save AND return the user', async () => {
    spies.create.mockResolvedValue(mocks.user);

    const result = await setup.save(mocks.user);

    expect(result).toEqual(mocks.user);
    expect(spies.create).toHaveBeenCalledTimes(1);
    expect(spies.create).toHaveBeenCalledWith({
      data: mocks.user,
    });
  });
});
