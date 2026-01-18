import { mocks, setup, spies } from './index.mocks';

describe('createUser', () => {
  it('SHOULD create a user AND return the id', async () => {
    spies.userMapper.toPersistence.mockReturnValue(mocks.userPersistence);
    // The implementation uses userDatasource.create
    spies.userDatasource.create.mockResolvedValue(mocks.userPersistence);

    const result = await setup.createUser(mocks.userEntity);

    expect(spies.userMapper.toPersistence).toHaveBeenCalledTimes(1);
    expect(spies.userMapper.toPersistence).toHaveBeenCalledWith(mocks.userEntity);

    expect(spies.userDatasource.create).toHaveBeenCalledTimes(1);
    expect(spies.userDatasource.create).toHaveBeenCalledWith(mocks.userPersistence);

    expect(result).toEqual({ id: mocks.userPersistence.id });
  });
});

describe('getUserByEmail', () => {
  it('SHOULD return a user entity WHEN user is found', async () => {
    spies.userDatasource.findByEmail.mockResolvedValue(mocks.userPersistence);
    spies.userMapper.toDomain.mockReturnValue(mocks.userEntity);

    const email = 'test@example.com';
    const result = await setup.getUserByEmail(email);

    expect(spies.userDatasource.findByEmail).toHaveBeenCalledTimes(1);
    expect(spies.userDatasource.findByEmail).toHaveBeenCalledWith(email);

    expect(spies.userMapper.toDomain).toHaveBeenCalledTimes(1);
    expect(spies.userMapper.toDomain).toHaveBeenCalledWith(mocks.userPersistence);

    expect(result).toEqual(mocks.userEntity);
  });

  it('SHOULD return undefined WHEN user is NOT found', async () => {
    spies.userDatasource.findByEmail.mockResolvedValue(null);

    const email = 'notfound@example.com';
    const result = await setup.getUserByEmail(email);

    expect(spies.userDatasource.findByEmail).toHaveBeenCalledTimes(1);
    expect(spies.userDatasource.findByEmail).toHaveBeenCalledWith(email);

    expect(spies.userMapper.toDomain).not.toHaveBeenCalled();

    expect(result).toBeUndefined();
  });
});

describe('getUserById', () => {
  it('SHOULD return a user entity WHEN user is found', async () => {
    spies.userDatasource.findById.mockResolvedValue(mocks.userPersistence);
    spies.userMapper.toDomain.mockReturnValue(mocks.userEntity);

    const id = '12345';
    const result = await setup.getUserById(id);

    expect(spies.userDatasource.findById).toHaveBeenCalledTimes(1);
    expect(spies.userDatasource.findById).toHaveBeenCalledWith(id);

    expect(spies.userMapper.toDomain).toHaveBeenCalledTimes(1);
    expect(spies.userMapper.toDomain).toHaveBeenCalledWith(mocks.userPersistence);

    expect(result).toEqual(mocks.userEntity);
  });

  it('SHOULD return undefined WHEN user is NOT found', async () => {
    spies.userDatasource.findById.mockResolvedValue(null);

    const id = '99999';
    const result = await setup.getUserById(id);

    expect(spies.userDatasource.findById).toHaveBeenCalledTimes(1);
    expect(spies.userDatasource.findById).toHaveBeenCalledWith(id);

    expect(spies.userMapper.toDomain).not.toHaveBeenCalled();

    expect(result).toBeUndefined();
  });
});

describe('updateUser', () => {
  it('SHOULD update the user AND return the updated entity', async () => {
    spies.userMapper.toPersistence.mockReturnValue(mocks.userPersistence);
    spies.userDatasource.update.mockResolvedValue(mocks.userPersistence);
    spies.userMapper.toDomain.mockReturnValue(mocks.userEntity);

    const result = await setup.updateUser(mocks.userEntity);

    expect(spies.userMapper.toPersistence).toHaveBeenCalledTimes(1);
    expect(spies.userMapper.toPersistence).toHaveBeenCalledWith(mocks.userEntity);

    expect(spies.userDatasource.update).toHaveBeenCalledTimes(1);
    expect(spies.userDatasource.update).toHaveBeenCalledWith(mocks.userPersistence);

    expect(spies.userMapper.toDomain).toHaveBeenCalledTimes(1);
    expect(spies.userMapper.toDomain).toHaveBeenCalledWith(mocks.userPersistence);

    expect(result).toEqual(mocks.userEntity);
  });
});
