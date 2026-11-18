import { faker } from '@faker-js/faker';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockEntity, { StockUnits } from '@stock/domain/entity/StockEntity';
import StockLotEntity from '@stock/domain/entity/StockLotEntity';

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
      createdAt: faker.date.past(),
      description: faker.commerce.product(),
      id: faker.string.uuid(),
      lots: [],
      owner: OwnerType.USER,
      ownerId: faker.string.uuid(),
      stockOnly: false,
      unit: StockUnits.UNIT,
      updatedAt: faker.date.recent(),
      warnDaysClosed: 7,
      warnDaysOpened: 1,
      // Optional properties
      barcode: undefined,
      brand: undefined,
      categoryId: undefined,
      idealQuantity: undefined,
      locationId: undefined,
      minQuantity: undefined,
      notes: undefined,
      openedShelfLifeDays: undefined,
    };
    return this;
  }

  // Builder methods

  withCategoryId(categoryId: string) {
    this.value.categoryId = categoryId;
    return this;
  }

  withDescription(description: string) {
    this.value.description = description;
    return this;
  }

  withId(id: string) {
    this.value.id = id;
    return this;
  }

  withLocationId(locationId: string) {
    this.value.locationId = locationId;
    return this;
  }

  withLots(lots: StockLotEntity[]) {
    this.value.lots = lots;
    return this;
  }

  withMinQuantity(minQuantity: number, idealQuantity?: number) {
    this.value.minQuantity = minQuantity;
    this.value.idealQuantity = idealQuantity;
    return this;
  }

  withOpenedShelfLifeDays(days: number) {
    this.value.openedShelfLifeDays = days;
    return this;
  }

  withOwner(owner: OwnerType) {
    this.value.owner = owner;
    return this;
  }

  withOwnerId(ownerId: string) {
    this.value.ownerId = ownerId;
    return this;
  }

  withShoppingListId(shoppingListId?: string) {
    this.value.shoppingListId = shoppingListId;
    return this;
  }

  withStockOnly(stockOnly = true) {
    this.value.stockOnly = stockOnly;
    return this;
  }

  withUnit(unit: StockUnits) {
    this.value.unit = unit;
    return this;
  }

  // Optional properties

  withBarcode(barcode: string = faker.string.numeric({ length: 13 })) {
    this.value.barcode = barcode;
    return this;
  }

  withBrand(brand: string = faker.company.name()) {
    this.value.brand = brand;
    return this;
  }

  withNotes(notes: string) {
    this.value.notes = notes;
    return this;
  }
}

export default StockEntityFixture;
