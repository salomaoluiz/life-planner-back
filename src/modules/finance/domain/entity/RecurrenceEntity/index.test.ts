import RecurrenceEntity from './index';
import { mocks, setup } from './index.mocks';

describe('RecurrenceEntity', () => {
  it('SHOULD create an instance of RecurrenceEntity with correct properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(RecurrenceEntity);
    expect(result).toEqual(mocks.params);
  });
});
