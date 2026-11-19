import { mocks, setup, spies } from './split.service.mocks';

const input = {
  date: '2026-11-15',
  description: 'Mercado',
  parts: [],
};

it('SHOULD create with the accessible owners AND answer { item, lookups } with the parts as lean rows', async () => {
  const result = await setup.create(mocks.userId, input as never, '2026-11-18');

  expect(spies.createSplitUseCase.execute).toHaveBeenCalledWith({
    ...input,
    accessibleOwners: mocks.accessibleOwners,
    requesterId: mocks.userId,
    today: '2026-11-18',
  });
  expect(result.item).toEqual(
    expect.objectContaining({
      description: mocks.split.description,
      id: mocks.split.id,
      total: 17000,
      type: 'EXPENSE',
    }),
  );
  expect(result.item.parts).toHaveLength(2);
  expect(result.item.parts[0]).toEqual(expect.objectContaining({ splitId: mocks.split.id }));
  expect(spies.splitLookupsService.attach).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    mocks.split.parts,
    expect.anything(),
  );
});

it('SHOULD read AND delete with the accessible owners', async () => {
  await setup.findById(mocks.userId, mocks.split.id);
  await setup.delete(mocks.userId, mocks.split.id);

  expect(spies.getSplitUseCase.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    id: mocks.split.id,
  });
  expect(spies.deleteSplitUseCase.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    id: mocks.split.id,
  });
});

it('SHOULD answer the split on update AND the ordinary transaction with dissolved: true when one part is left', async () => {
  const updated = await setup.update(mocks.userId, mocks.split.id, { paid: true });

  expect(spies.updateSplitUseCase.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.split.id,
      paid: true,
    }),
  );
  expect(updated).not.toHaveProperty('dissolved');

  spies.updateSplitUseCase.execute.mockResolvedValueOnce({ dissolved: mocks.dissolved });

  expect(await setup.update(mocks.userId, mocks.split.id, { paid: true })).toEqual(
    expect.objectContaining({
      dissolved: true,
      item: expect.objectContaining({ id: mocks.dissolved.id }),
    }),
  );
});
