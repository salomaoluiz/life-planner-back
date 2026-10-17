import { mocks, setup } from './index.mocks';

it('SHOULD keep every field it receives', () => {
  expect(setup()).toEqual(mocks.params);
});
