import { UpdateShoppingListApiSchema } from './shoppingList.dto';

describe('UpdateShoppingListApiSchema purchaseIntervalDays', () => {
  it.each([1, 7, 90])('SHOULD accept %d days', (days) => {
    expect(UpdateShoppingListApiSchema.safeParse({ purchaseIntervalDays: days }).success).toBe(
      true,
    );
  });

  it.each([0, 91, 1.5, -3])('SHOULD refuse %d days', (days) => {
    expect(UpdateShoppingListApiSchema.safeParse({ purchaseIntervalDays: days }).success).toBe(
      false,
    );
  });
});
