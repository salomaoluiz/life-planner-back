import { mocks, setup } from './index.mocks';

it('SHOULD return true WHEN the user is a joined member', async () => {
  expect(await setup.execute(mocks.input)).toBe(true);
  expect(mocks.familyRepository.isFamilyMember).toHaveBeenCalledWith(mocks.input);
});

it('SHOULD return false WHEN the user is NOT a joined member (pending invite or stranger)', async () => {
  mocks.familyRepository.isFamilyMember.mockResolvedValueOnce(false);

  expect(await setup.execute(mocks.input)).toBe(false);
});
