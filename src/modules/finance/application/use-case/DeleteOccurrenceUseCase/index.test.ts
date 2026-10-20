import { InstallmentEditScope } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

const base = {
  accessibleOwners: mocks.accessibleOwners,
  occurrenceNumber: 4,
  recurrenceId: 'series-1',
  scope: InstallmentEditScope.ONLY_THIS,
  today: '2026-10-17',
};

describe('scope ONLY_THIS', () => {
  it('SHOULD delete the real row through the transaction rules, leaving the others numbered as they were', async () => {
    await setup.execute(base);

    expect(mocks.deleteTransaction.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'row-4',
      scope: 'ONLY_THIS',
    });
    expect(mocks.recurrenceRepository.skipNumber).not.toHaveBeenCalled();
  });

  it('SHOULD hide a projected occurrence for good', async () => {
    await setup.execute({ ...base, occurrenceNumber: 12 });

    expect(mocks.recurrenceRepository.skipNumber).toHaveBeenCalledWith('series-1', 12);
    expect(mocks.deleteTransaction.execute).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 WHEN the occurrence was already deleted (a hole OR a skipped number)', async () => {
    await expect(setup.execute({ ...base, occurrenceNumber: 8 })).rejects.toThrow(
      'Occurrence was deleted',
    );
    await expect(setup.execute({ ...base, occurrenceNumber: 14 })).rejects.toThrow(
      'Occurrence was deleted',
    );
  });

  it('SHOULD answer 404 WHEN the number is outside the series', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue({
      ...mocks.series,
      endDate: '2026-12-05',
    });

    await expect(setup.execute({ ...base, occurrenceNumber: 13 })).rejects.toThrow(
      'Occurrence not found',
    );

    mocks.recurrenceRepository.findById.mockResolvedValue({ ...mocks.series, firstNumber: 5 });

    await expect(setup.execute({ ...base, occurrenceNumber: 2 })).rejects.toThrow(
      'Occurrence not found',
    );
  });
});

describe('scope THIS_AND_NEXT', () => {
  const scope = InstallmentEditScope.THIS_AND_NEXT;

  it('SHOULD end the series at the previous occurrence AND remove the rows from the number', async () => {
    await setup.execute({ ...base, confirmPaid: true, scope });

    expect(mocks.recurrenceRepository.removeFrom).toHaveBeenCalledWith({
      confirmPaid: true,
      deleteSeries: false,
      detachLocked: false,
      fromNumber: 4,
      id: 'series-1',
      seriesPatch: {
        endDate: '2026-03-05',
        lastGeneratedNumber: 3,
        nextOccurrenceDate: null,
        skippedNumbers: [],
        status: 'ENDED',
      },
    });
  });

  it('SHOULD keep the generated count WHEN the split is after what exists', async () => {
    await setup.execute({ ...base, occurrenceNumber: 12, scope });

    expect(mocks.recurrenceRepository.removeFrom.mock.calls[0][0].seriesPatch).toEqual(
      expect.objectContaining({ lastGeneratedNumber: 10, skippedNumbers: [] }),
    );
  });

  it('SHOULD delete the whole series WHEN it starts at the first occurrence', async () => {
    await setup.execute({ ...base, confirmPaid: true, occurrenceNumber: 1, scope });

    expect(mocks.deleteRecurrence.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      confirmPaid: true,
      id: 'series-1',
    });
    expect(mocks.recurrenceRepository.removeFrom).not.toHaveBeenCalled();
  });
});

describe('access', () => {
  it('SHOULD answer 404 for a missing OR inaccessible series', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue({ ...mocks.series, ownerId: 'other' });

    await expect(setup.execute(base)).rejects.toThrow('Not Found');
  });
});

describe('this and the next ones from a projected occurrence ahead of what exists (review)', () => {
  it('SHOULD keep the series active up to the previous occurrence', async () => {
    await setup.execute({
      ...base,
      occurrenceNumber: 12,
      scope: InstallmentEditScope.THIS_AND_NEXT,
    });

    expect(mocks.recurrenceRepository.removeFrom.mock.calls[0][0].seriesPatch).toEqual(
      expect.objectContaining({
        endDate: '2026-11-05',
        lastGeneratedNumber: 10,
        nextOccurrenceDate: '2026-11-05',
        status: 'ACTIVE',
      }),
    );
  });
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = base;
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});
