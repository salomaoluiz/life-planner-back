import { mocks, setup, spies } from './index.mocks';

it('SHOULD read the unique ids once AND keep only the splits the caller can read', async () => {
  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    splitIds: ['split-1', 'split-1', 'split-2'],
  });

  expect(spies.splitRepository.findSplitSummaries).toHaveBeenCalledWith(['split-1', 'split-2']);
  expect(result).toEqual([mocks.summary]);
});
