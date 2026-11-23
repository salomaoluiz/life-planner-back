import { AiUsageRepository } from './index';

const datasource = { consume: jest.fn(), findDay: jest.fn() };
const repository = new AiUsageRepository(datasource);

beforeEach(() => jest.clearAllMocks());

it('SHOULD map a refused consume (null) to undefined', async () => {
  datasource.consume.mockResolvedValue(null);

  expect(await repository.consume('u', 'LIGHT', '2026-11-23', 50)).toBeUndefined();
});

it('SHOULD return the new count', async () => {
  datasource.consume.mockResolvedValue(4);

  expect(await repository.consume('u', 'LIGHT', '2026-11-23', 50)).toBe(4);
});

it('SHOULD default the kinds without a row to 0', async () => {
  datasource.findDay.mockResolvedValue([{ count: 8, kind: 'SEARCH' }]);

  expect(await repository.findDay('u', '2026-11-23')).toEqual({ LIGHT: 0, SEARCH: 8 });
});
