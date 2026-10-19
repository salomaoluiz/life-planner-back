import { mocks, setup } from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, id: 'series-1', today: '2026-10-17' };

describe('GetRecurrenceUseCase', () => {
  it('SHOULD return the series, its real rows AND the next projected occurrences', async () => {
    const result = await setup.execute(base);

    expect(result).toEqual({
      occurrences: mocks.occurrences,
      projected: [{ occurrenceNumber: 2 }],
      recurrence: mocks.series,
    });
  });

  it('SHOULD project up to 12 occurrences after the horizon, hiding skipped and real numbers', async () => {
    await setup.execute(base);

    const scheduled = mocks.getProjections.project.mock.calls[0][1];

    // Monthly from 2026-10-05: k=2 is 2026-11-05. Number 3 (skipped) and 5 (real) are left out.
    expect(scheduled.map((item: { k: number }) => item.k).slice(0, 3)).toEqual([2, 4, 6]);
    expect(scheduled).toHaveLength(12);
  });

  it('SHOULD not project an ended series', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue({ ...mocks.series, status: 'ENDED' });

    const result = await setup.execute(base);

    expect(result.projected).toEqual([]);
    expect(mocks.getProjections.project).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 for a missing OR inaccessible series', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue(undefined);

    await expect(setup.execute(base)).rejects.toThrow('Not Found');

    mocks.recurrenceRepository.findById.mockResolvedValue({ ...mocks.series, ownerId: 'other' });

    await expect(setup.execute(base)).rejects.toThrow('Not Found');
  });
});
