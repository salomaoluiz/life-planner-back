import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { IStockRepository } from '@stock/domain/repository';

import { assertBarcodeFree, normalizeOrThrow } from './index';

const target = { owner: OwnerType.USER, ownerId: 'user-id' };

function repoWith(items: { description: string; id: string }[]) {
  return { findByOwners: jest.fn().mockResolvedValue(items) } as unknown as IStockRepository;
}

describe('normalizeOrThrow', () => {
  it('SHOULD return the normalized code', () => {
    expect(normalizeOrThrow('036000291452')).toBe('0036000291452');
  });

  it('SHOULD throw 422 BARCODE_INVALID for a wrong check digit', () => {
    expect(() => normalizeOrThrow('7891000100104')).toThrow(UnprocessableEntityException);
  });
});

describe('assertBarcodeFree', () => {
  it('SHOULD pass WHEN nobody holds the code', async () => {
    await expect(assertBarcodeFree(repoWith([]), target, '123')).resolves.toBeUndefined();
  });

  it('SHOULD throw 409 BARCODE_IN_USE with the holder', async () => {
    const error = await assertBarcodeFree(
      repoWith([{ description: 'Leite', id: 'item-1' }]),
      target,
      '123',
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({
      code: 'BARCODE_IN_USE',
      description: 'Leite',
      itemId: 'item-1',
    });
  });

  it('SHOULD ignore the item itself', async () => {
    await expect(
      assertBarcodeFree(
        repoWith([{ description: 'Leite', id: 'item-1' }]),
        target,
        '123',
        'item-1',
      ),
    ).resolves.toBeUndefined();
  });
});
