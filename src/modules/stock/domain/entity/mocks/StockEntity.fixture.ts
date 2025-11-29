import { faker } from '@faker-js/faker';

import StockEntity, { StockUnits } from '@stock/domain/entity/StockEntity';

class StockEntityFixture {
  value = {} as StockEntity;

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
      description: faker.commerce.product(),
      id: faker.string.uuid(),
      ownerId: faker.string.uuid(),
      quantity: faker.number.int({ max: 50, min: 1 }),
      unit: StockUnits.UNIT,
      // Optional properties
      barcode: undefined,
      brand: undefined,
      expirationDate: undefined,
      notes: undefined,
      openingDate: undefined,
      purchaseDate: undefined,
    };
    return this;
  }

  // Builder methods

  withBarcode(barcode: string = faker.string.numeric({ length: 13 })) {
    this.value.barcode = barcode;
    return this;
  }

  withBrand(brand: string = faker.company.name()) {
    this.value.brand = brand;
    return this;
  }

  withDescription(description: string) {
    this.value.description = description;
    return this;
  }

  withExpirationDate(expirationDate: Date = faker.date.soon({ days: 60 })) {
    this.value.expirationDate = expirationDate;
    return this;
  }

  withId(id: string) {
    this.value.id = id;
    return this;
  }

  withNotes(notes: string) {
    this.value.notes = notes;
    return this;
  }

  withOpeningDate(openingDate: Date) {
    this.value.openingDate = openingDate;
    return this;
  }

  withOwnerId(ownerId: string) {
    this.value.ownerId = ownerId;
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

  withUnit(unit: StockUnits) {
    this.value.unit = unit;
    return this;
  }
}

export default StockEntityFixture;
