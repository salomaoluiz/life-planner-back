import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import StockLocationEntity from './index';

it('SHOULD keep every property', () => {
  const date = new Date('2026-11-10T00:00:00.000Z');
  const location = new StockLocationEntity({
    createdAt: date,
    id: 'l',
    name: 'Pantry',
    owner: OwnerType.FAMILY,
    ownerId: 'f',
    status: StockCatalogStatus.ARCHIVED,
    updatedAt: date,
  });

  expect(location).toMatchObject({ name: 'Pantry', owner: 'FAMILY', status: 'ARCHIVED' });
});
