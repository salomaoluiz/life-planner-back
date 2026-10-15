import { mocks, setup, spies } from './index.mocks';

const anyHashWhere = {
  OR: [{ token_hash: 'h' }, { previous_token_hash: 'h' }, { retired_token_hash: 'h' }],
};

it('SHOULD create the row with every column', async () => {
  await setup.create(mocks.session);

  expect(spies.create).toHaveBeenCalledWith({ data: mocks.session });
});

it('SHOULD find by any of the three hashes', async () => {
  spies.findFirst.mockResolvedValueOnce(mocks.session);

  expect(await setup.findByTokenHash('h')).toBe(mocks.session);
  expect(spies.findFirst).toHaveBeenCalledWith({ where: anyHashWhere });
});

it('SHOULD rotate only WHEN the stored current hash is still the expected one', async () => {
  spies.updateMany.mockResolvedValueOnce({ count: 1 });

  expect(await setup.rotate('old', mocks.session)).toBe(true);
  expect(spies.updateMany).toHaveBeenCalledWith({
    data: {
      last_used_at: mocks.session.last_used_at,
      previous_token_hash: mocks.session.previous_token_hash,
      retired_token_hash: mocks.session.retired_token_hash,
      rotated_at: mocks.session.rotated_at,
      token_hash: mocks.session.token_hash,
    },
    where: { id: mocks.session.id, token_hash: 'old' },
  });
});

it('SHOULD report false WHEN another request rotated first (count 0)', async () => {
  spies.updateMany.mockResolvedValueOnce({ count: 0 });

  expect(await setup.rotate('old', mocks.session)).toBe(false);
});

it('SHOULD delete by id', async () => {
  await setup.deleteById('session-id');

  expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: 'session-id' } });
});

it('SHOULD delete by any of the three hashes', async () => {
  await setup.deleteByTokenHash('h');

  expect(spies.deleteMany).toHaveBeenCalledWith({ where: anyHashWhere });
});

it('SHOULD delete expired rows by last_used_at AND return how many', async () => {
  spies.deleteMany.mockResolvedValueOnce({ count: 3 });
  const before = new Date();

  expect(await setup.deleteExpired(before)).toBe(3);
  expect(spies.deleteMany).toHaveBeenCalledWith({ where: { last_used_at: { lt: before } } });
});
