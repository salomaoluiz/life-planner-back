import SplitEntityFixture from '@finance/domain/entity/mocks/SplitEntity.fixture';
import { TransactionType } from '@finance/domain/enum';

it('SHOULD derive the total and the direction from the parts', () => {
  const split = new SplitEntityFixture().build();

  expect(split.total).toBe(17000);
  expect(split.type).toBe(TransactionType.EXPENSE);
  expect(split.parts).toHaveLength(2);
});
