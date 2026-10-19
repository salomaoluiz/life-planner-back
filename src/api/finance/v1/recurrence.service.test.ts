import { InstallmentEditScope } from '@finance/domain/enum';

import { mocks, setup } from './recurrence.service.mocks';

describe('create', () => {
  it('SHOULD resolve the owners, call the use case AND return the series with its rows', async () => {
    const input = {
      accountId: mocks.series.accountId as string,
      categoryId: mocks.series.categoryId,
      date: '2026-10-05',
      description: 'Rent',
      frequency: mocks.series.frequency,
      owner: mocks.series.owner,
      ownerId: mocks.series.ownerId,
      type: mocks.series.type,
      value: 200000,
    };

    const result = await setup.create(mocks.userId, input, '2026-10-17');

    expect(mocks.create.execute).toHaveBeenCalledWith({
      ...input,
      accessibleOwners: mocks.accessibleOwners,
      today: '2026-10-17',
    });
    expect(result.recurrence).toEqual(
      expect.objectContaining({
        endDate: '2027-09-05',
        id: mocks.series.id,
        occurrenceCount: mocks.series.occurrenceCount,
      }),
    );
    expect(result.occurrences[0]).toEqual(
      expect.objectContaining({ id: mocks.row.id, recurrenceId: mocks.series.id }),
    );
    expect(result.overLimit).toBe(false);
  });
});

describe('reads', () => {
  it('SHOULD list series with the filter AND owners', async () => {
    const result = await setup.findAll(mocks.userId, ['o1'], { status: 'ACTIVE' as never });

    expect(mocks.getRecurrences.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['o1'],
      status: 'ACTIVE',
    });
    expect(result).toHaveLength(1);
  });

  it('SHOULD return a series with its real rows AND the projected ones', async () => {
    const result = await setup.findOne(mocks.userId, mocks.series.id, '2026-10-17');

    expect(mocks.getRecurrence.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.series.id,
      today: '2026-10-17',
    });
    expect(result.projected).toEqual([mocks.projected]);
    expect(result.occurrences).toHaveLength(1);
  });

  it('SHOULD materialize BEFORE projecting so a real row is never projected twice', async () => {
    const order: string[] = [];

    mocks.materializeRecurrences.execute.mockImplementationOnce(async () => {
      order.push('materialize');
    });
    mocks.getProjections.execute.mockImplementationOnce(async () => {
      order.push('project');

      return [mocks.projected];
    });

    const result = await setup.findProjections(
      mocks.userId,
      { from: '2026-11', to: '2027-03' },
      ['o1'],
      '2026-10-17',
    );

    expect(order).toEqual(['materialize', 'project']);
    expect(mocks.getProjections.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      from: '2026-11',
      ownerIds: ['o1'],
      to: '2027-03',
      today: '2026-10-17',
    });
    expect(result).toEqual([mocks.projected]);
  });
});

describe('writes', () => {
  it('SHOULD update (scope ALL)', async () => {
    const result = await setup.update(mocks.userId, mocks.series.id, { value: 1 }, '2026-10-17');

    expect(mocks.update.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.series.id,
      today: '2026-10-17',
      value: 1,
    });
    expect(result.id).toBe(mocks.series.id);
  });

  it('SHOULD split AND return both series', async () => {
    const result = await setup.split(
      mocks.userId,
      mocks.series.id,
      { occurrenceNumber: 5, value: 1 },
      '2026-10-17',
    );

    expect(mocks.split.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.series.id,
      occurrenceNumber: 5,
      today: '2026-10-17',
      value: 1,
    });
    expect(result.ended?.id).toBe(mocks.series.id);
    expect(result.recurrence.id).toBe(mocks.series.id);
  });

  it('SHOULD return null for ended WHEN the split rewrote the series itself', async () => {
    mocks.split.execute.mockResolvedValue({
      ended: null,
      occurrences: [],
      recurrence: mocks.series,
    });

    expect(
      (await setup.split(mocks.userId, mocks.series.id, { occurrenceNumber: 1 })).ended,
    ).toBeNull();
  });

  it('SHOULD materialize a projected occurrence AND carry overLimit only for card rows', async () => {
    const result = await setup.materializeOccurrence(
      mocks.userId,
      mocks.series.id,
      2,
      { scope: InstallmentEditScope.ONLY_THIS, value: 5 },
      '2026-10-17',
    );

    expect(mocks.materializeOccurrence.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      occurrenceNumber: 2,
      recurrenceId: mocks.series.id,
      today: '2026-10-17',
      value: 5,
    });
    expect(result).toEqual(expect.objectContaining({ id: mocks.row.id, overLimit: undefined }));
  });

  it('SHOULD carry overLimit for a card occurrence', async () => {
    mocks.materializeOccurrence.execute.mockResolvedValue({
      overLimit: true,
      transaction: { ...mocks.row, creditCardId: 'card-1' },
    });

    expect(
      (await setup.materializeOccurrence(mocks.userId, mocks.series.id, 2, {})).overLimit,
    ).toBe(true);
  });
});

describe('deletes', () => {
  it('SHOULD delete an occurrence by scope with the confirmation', async () => {
    await setup.deleteOccurrence(
      mocks.userId,
      mocks.series.id,
      4,
      'THIS_AND_NEXT' as never,
      true,
      '2026-10-17',
    );

    expect(mocks.deleteOccurrence.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      confirmPaid: true,
      occurrenceNumber: 4,
      recurrenceId: mocks.series.id,
      scope: 'THIS_AND_NEXT',
      today: '2026-10-17',
    });
  });

  it('SHOULD delete the series AND return the counts', async () => {
    expect(await setup.delete(mocks.userId, mocks.series.id, true)).toEqual({
      deleted: 3,
      detached: 1,
    });
    expect(mocks.deleteRecurrence.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      confirmPaid: true,
      id: mocks.series.id,
    });
  });
});
