import { mocks, setup } from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, accountId: 'account-1' };

describe('EndRecurrencesBySourceUseCase', () => {
  it('SHOULD end each active series at its last real occurrence AND return how many', async () => {
    expect(await setup.execute(base)).toBe(1);

    expect(mocks.recurrenceRepository.findByOwners).toHaveBeenCalledWith(mocks.accessibleOwners, {
      accountId: 'account-1',
      creditCardId: undefined,
      status: 'ACTIVE',
    });
    expect(mocks.recurrenceRepository.applyChange).toHaveBeenCalledWith({
      fromNumber: 4,
      rowPatch: {},
      seriesPatch: { endDate: '2026-12-05', nextOccurrenceDate: null, status: 'ENDED' },
      sourceId: 'series-1',
    });
  });

  it('SHOULD keep the end date empty WHEN nothing was generated yet', async () => {
    mocks.recurrenceRepository.findByOwners.mockResolvedValue([
      { ...mocks.series, lastGeneratedNumber: 0 },
    ]);

    await setup.execute({ ...base, accountId: undefined, creditCardId: 'card-1' });

    expect(mocks.recurrenceRepository.applyChange.mock.calls[0][0].seriesPatch).toEqual({
      endDate: undefined,
      nextOccurrenceDate: null,
      status: 'ENDED',
    });
  });

  it('SHOULD do nothing WHEN the source has no active series', async () => {
    mocks.recurrenceRepository.findByOwners.mockResolvedValue([]);

    expect(await setup.execute(base)).toBe(0);
    expect(mocks.recurrenceRepository.applyChange).not.toHaveBeenCalled();
  });

  it('SHOULD require exactly one source', async () => {
    await expect(setup.execute({ accessibleOwners: mocks.accessibleOwners })).rejects.toThrow();
    await expect(setup.execute({ ...base, creditCardId: 'card-1' })).rejects.toThrow();
  });
});
