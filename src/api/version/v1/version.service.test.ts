import { mocks, setup } from './version.service.mocks';

it('SHOULD return the use case output AND forward the refresh flag', async () => {
  expect(await setup.get(true)).toBe(mocks.output);
  expect(mocks.getVersionInfo.execute).toHaveBeenCalledWith({ refresh: true });
});
