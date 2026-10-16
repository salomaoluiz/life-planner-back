import InstallmentPlanEntity from './index';
import { mocks, setup } from './index.mocks';

describe('InstallmentPlanEntity', () => {
  it('SHOULD create an instance of InstallmentPlanEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(InstallmentPlanEntity);
    expect(result).toEqual(mocks.params);
  });
});
