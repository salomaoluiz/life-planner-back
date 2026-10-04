import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD create the family with the owner data AND return it', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.familyRepository.createFamily).toHaveBeenCalledWith(mocks.input);
  expect(result).toEqual({
    createdAt: mocks.family.createdAt,
    id: mocks.family.id,
    name: mocks.family.name,
    ownerId: mocks.family.ownerId,
    updatedAt: mocks.family.updatedAt,
  });
});

it('SHOULD trim the name before persisting', async () => {
  await setup.execute({ ...mocks.input, name: '  Example Family ' });

  expect(mocks.familyRepository.createFamily).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Example Family' }),
  );
});

it('SHOULD accept a name of exactly 50 characters (after trimming)', async () => {
  await setup.execute({ ...mocks.input, name: `  ${'a'.repeat(50)}  ` });

  expect(mocks.familyRepository.createFamily).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'a'.repeat(50) }),
  );
});

it.each([
  ['empty', ''],
  ['whitespace-only', '   '],
  ['51 characters', 'a'.repeat(51)],
])('SHOULD throw ValidationError AND persist nothing WHEN the name is %s', async (_label, name) => {
  await expect(setup.execute({ ...mocks.input, name })).rejects.toThrow(ValidationError);
  expect(mocks.familyRepository.createFamily).not.toHaveBeenCalled();
});
