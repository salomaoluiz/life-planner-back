import { UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { ensureOwnerWritable } from './index';

const archived = { archived: true, owner: OwnerType.FAMILY, ownerId: 'family-1' };
const active = { owner: OwnerType.FAMILY, ownerId: 'family-2' };
const user = { owner: OwnerType.USER, ownerId: 'user-1' };

describe('ensureOwnerWritable', () => {
  it('SHOULD throw 422 "Family is archived" WHEN the target family is archived', () => {
    expect(() => ensureOwnerWritable([user, archived, active], archived)).toThrow(
      new UnprocessableEntityException('Family is archived'),
    );
  });

  it('SHOULD pass for an active family AND for the user', () => {
    expect(() => ensureOwnerWritable([user, archived, active], active)).not.toThrow();
    expect(() => ensureOwnerWritable([user, archived, active], user)).not.toThrow();
  });

  it('SHOULD pass WHEN the target is not in the accessible list (callers answer 404)', () => {
    expect(() => ensureOwnerWritable([user], archived)).not.toThrow();
  });
});
