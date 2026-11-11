import { UnprocessableEntityException } from '@nestjs/common';

import { FractionSaleBreaksError } from '@investment/domain/error/FractionSaleBreaksError';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { NoPositionError } from '@investment/domain/error/NoPositionError';

import { toPositionException } from './index';

describe('toPositionException', () => {
  it('SHOULD answer 422 with the date AND the operation for a negative position', () => {
    const result = toPositionException(new NegativePositionError('2026-04-01', 'op-1'));

    expect(result).toBeInstanceOf(UnprocessableEntityException);
    expect((result as UnprocessableEntityException).getResponse()).toEqual({
      details: { date: '2026-04-01', operationId: 'op-1' },
      message: 'This change would make the position negative on 2026-04-01',
    });
  });

  it('SHOULD answer 422 for an event where no shares are held', () => {
    const result = toPositionException(new NoPositionError('2026-03-10'));

    expect((result as UnprocessableEntityException).getResponse()).toEqual({
      details: { date: '2026-03-10' },
      message: 'There is no position on 2026-03-10',
    });
  });

  it('SHOULD answer 422 for a fraction sale that would lose its fraction', () => {
    const result = toPositionException(new FractionSaleBreaksError('2026-04-04'));

    expect((result as UnprocessableEntityException).getResponse()).toEqual({
      details: { date: '2026-04-04' },
      message:
        'This change removes the fraction sold on 2026-04-04. Delete the fraction sale first.',
    });
  });

  it('SHOULD hand any other error back untouched', () => {
    const error = new Error('boom');

    expect(toPositionException(error)).toBe(error);
  });
});
