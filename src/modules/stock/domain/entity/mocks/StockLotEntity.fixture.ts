import { faker } from '@faker-js/faker';

import StockLotEntity from '@stock/domain/entity/StockLotEntity';

class StockLotEntityFixture {
  value = {} as StockLotEntity;

  constructor() {
    this.withDefault();
  }

  build() {
    const temp = { ...this.value };
    this.withDefault();
    return temp;
  }

  withDefault() {
    this.value = {
      createdAt: faker.date.past(),
      expirationDate: undefined,
      id: faker.string.uuid(),
      itemId: faker.string.uuid(),
      openedAt: undefined,
      purchaseDate: undefined,
      quantity: faker.number.int({ max: 50, min: 1 }),
    };
    return this;
  }

  withExpirationDate(expirationDate: Date) {
    this.value.expirationDate = expirationDate;
    return this;
  }

  withId(id: string) {
    this.value.id = id;
    return this;
  }

  withItemId(itemId: string) {
    this.value.itemId = itemId;
    return this;
  }

  withOpenedAt(openedAt: Date) {
    this.value.openedAt = openedAt;
    return this;
  }

  withPurchaseDate(purchaseDate: Date) {
    this.value.purchaseDate = purchaseDate;
    return this;
  }

  withQuantity(quantity: number) {
    this.value.quantity = quantity;
    return this;
  }
}

export default StockLotEntityFixture;
