import { UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { ensureOwnerWritable } from './index';

it('SHOULD refuse a write on an archived family only', () => {
  const owners = [
    { archived: true, owner: OwnerType.FAMILY, ownerId: 'f1' },
    { owner: OwnerType.FAMILY, ownerId: 'f2' },
  ];

  expect(() => ensureOwnerWritable(owners, { owner: OwnerType.FAMILY, ownerId: 'f1' })).toThrow(
    UnprocessableEntityException,
  );
  expect(() =>
    ensureOwnerWritable(owners, { owner: OwnerType.FAMILY, ownerId: 'f2' }),
  ).not.toThrow();
  expect(() =>
    ensureOwnerWritable(owners, { owner: OwnerType.USER, ownerId: 'unknown' }),
  ).not.toThrow();
});
