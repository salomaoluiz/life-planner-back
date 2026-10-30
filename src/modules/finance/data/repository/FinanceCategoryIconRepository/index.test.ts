import { mocks, setup } from './index.mocks';

it('SHOULD map rows to entities for the three reads', async () => {
  expect(await setup.listAll()).toEqual([mocks.entity]);
  expect(await setup.search({ limit: 5, terms: ['pas'] })).toEqual([mocks.entity]);
  expect(await setup.searchSimilar({ limit: 5, text: 'psata' })).toEqual([mocks.entity]);
  expect(mocks.datasource.search).toHaveBeenCalledWith({ limit: 5, terms: ['pas'] });
  expect(mocks.datasource.searchSimilar).toHaveBeenCalledWith({ limit: 5, text: 'psata' });
});
