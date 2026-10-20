import { mocks, setup } from './index.mocks';

describe('DeleteRecurrenceUseCase', () => {
  it('SHOULD delete the series and every row, detaching locked card rows, and return the counts', async () => {
    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      id: 'series-1',
    });

    expect(result).toEqual({ deleted: 3, detached: 1 });
    expect(mocks.recurrenceRepository.removeFrom).toHaveBeenCalledWith({
      confirmPaid: false,
      deleteSeries: true,
      detachLocked: true,
      fromNumber: 0,
      id: 'series-1',
    });
  });

  it('SHOULD pass the paid confirmation through', async () => {
    await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      confirmPaid: true,
      id: 'series-1',
    });

    expect(mocks.recurrenceRepository.removeFrom).toHaveBeenCalledWith(
      expect.objectContaining({ confirmPaid: true }),
    );
  });

  it('SHOULD answer 404 for a missing OR inaccessible series', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue({ ...mocks.series, ownerId: 'other' });

    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'series-1' }),
    ).rejects.toThrow('Not Found');

    mocks.recurrenceRepository.findById.mockResolvedValue(undefined);

    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'series-1' }),
    ).rejects.toThrow('Not Found');
    expect(mocks.recurrenceRepository.removeFrom).not.toHaveBeenCalled();
  });
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = {
    accessibleOwners: mocks.accessibleOwners,
    id: 'series-1',
  };
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});
