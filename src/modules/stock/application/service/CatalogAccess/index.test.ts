import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { ensureCatalogWritable, ensureOwnerReadable } from './index';

const owners = [
  { owner: OwnerType.USER, ownerId: 'u' },
  { archived: true, owner: OwnerType.FAMILY, ownerId: 'f' },
];

it('SHOULD answer 404 for an owner the caller cannot reach', () => {
  expect(() => ensureOwnerReadable(owners, { owner: OwnerType.USER, ownerId: 'x' })).toThrow(
    NotFoundException,
  );
  expect(() => ensureCatalogWritable(owners, { owner: OwnerType.USER, ownerId: 'x' })).toThrow(
    NotFoundException,
  );
});

it('SHOULD allow reading an archived family but refuse writing with 422', () => {
  expect(() => ensureOwnerReadable(owners, owners[1])).not.toThrow();
  expect(() => ensureCatalogWritable(owners, owners[1])).toThrow(UnprocessableEntityException);
  expect(() => ensureCatalogWritable(owners, owners[0])).not.toThrow();
});
