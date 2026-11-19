import { mocks, setup, shoppingList } from './index.mocks';

it('SHOULD create the default list named by the language (pt-BR without one)', async () => {
  mocks.lists.ensureDefault.mockResolvedValue(shoppingList('d', { isDefault: true }));

  await setup.execute({ access: mocks.access, language: 'en-US' });
  await setup.execute({ access: mocks.access });

  expect(mocks.lists.ensureDefault).toHaveBeenNthCalledWith(1, mocks.access, 'Groceries');
  expect(mocks.lists.ensureDefault).toHaveBeenNthCalledWith(2, mocks.access, 'Mercado');
});

it('SHOULD only return the existing default of an archived family, never create one', async () => {
  const archived = { ...mocks.access, archived: true };

  mocks.lists.findByOwners.mockResolvedValue([shoppingList('d', { isDefault: true })]);
  expect((await setup.execute({ access: archived }))?.id).toBe('d');

  mocks.lists.findByOwners.mockResolvedValue([]);
  expect(await setup.execute({ access: archived })).toBeUndefined();
  expect(mocks.lists.ensureDefault).not.toHaveBeenCalled();
});
