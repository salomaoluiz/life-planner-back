import { StockUnit } from '@db/client';
import { StockUnits } from '@stock/domain/entity/StockEntity';

// The Prisma client validates enum args against the schema MEMBER names, not their @map values:
// an `UNIT @map("unit")` member made `create({ unit: 'liter' })` fail at runtime. Members must be
// declared lowercase (no @map), so the generated keys equal the domain wire values.
it('SHOULD generate StockUnit members (keys AND values) equal to the domain wire values', () => {
  const wire = Object.values(StockUnits).sort();

  expect(Object.keys(StockUnit).sort()).toEqual(wire);
  expect(Object.values(StockUnit).sort()).toEqual(wire);
});
