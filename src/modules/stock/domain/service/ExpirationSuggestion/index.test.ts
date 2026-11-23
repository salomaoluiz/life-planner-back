import { suggestExpiration } from './index';

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

describe('suggestExpiration', () => {
  it('SHOULD add the median span of the recent dated lots to the purchase date', () => {
    const suggestion = suggestExpiration(
      [
        { expirationDate: day('2026-06-11'), purchaseDate: day('2026-06-01') },
        { expirationDate: day('2026-07-21'), purchaseDate: day('2026-07-01') },
        { expirationDate: day('2026-08-31'), purchaseDate: day('2026-08-01') },
      ],
      day('2026-11-10'),
    );

    expect(suggestion).toEqual(day('2026-11-30'));
  });

  it('SHOULD average the two middle spans for an even count', () => {
    expect(
      suggestExpiration(
        [
          { expirationDate: day('2026-06-11'), purchaseDate: day('2026-06-01') },
          { expirationDate: day('2026-07-21'), purchaseDate: day('2026-07-01') },
        ],
        day('2026-11-10'),
      ),
    ).toEqual(day('2026-11-25'));
  });

  it('SHOULD ignore lots older than 12 months or without both dates AND answer nothing without any', () => {
    expect(
      suggestExpiration(
        [
          { expirationDate: day('2024-06-11'), purchaseDate: day('2024-06-01') },
          { expirationDate: day('2026-07-21') },
          { purchaseDate: day('2026-07-21') },
        ],
        day('2026-11-10'),
      ),
    ).toBeUndefined();
  });
});
