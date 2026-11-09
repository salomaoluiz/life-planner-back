import { UnprocessableEntityException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

it('SHOULD delete the transfer WHEN both owners are writable', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transfer.id });

  expect(spies.transferRepository.deleteTransfer).toHaveBeenCalledWith(mocks.transfer.id);
});

it('SHOULD refuse WHEN one family is archived AND delete nothing', async () => {
  const archived = mocks.accessibleOwners.map((owner, index) =>
    index === 0 ? { ...owner, archived: true } : owner,
  );

  await expect(
    setup.execute({ accessibleOwners: archived, id: mocks.transfer.id }),
  ).rejects.toThrow(UnprocessableEntityException);
  expect(spies.transferRepository.deleteTransfer).not.toHaveBeenCalled();
});

it('SHOULD not delete WHEN the transfer is not readable', async () => {
  spies.getTransfer.execute.mockRejectedValueOnce(new Error('Transfer not found'));

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transfer.id }),
  ).rejects.toThrow('Transfer not found');
  expect(spies.transferRepository.deleteTransfer).not.toHaveBeenCalled();
});

describe('series occurrences (spec 098 FR 8)', () => {
  const occurrence = { ...mocks.transfer, occurrenceNumber: 3, recurrenceId: 'series-1' };
  const base = { accessibleOwners: mocks.accessibleOwners, id: mocks.transfer.id };

  beforeEach(() => {
    spies.getTransfer.execute.mockResolvedValue(occurrence);
  });

  it('SHOULD require a scope for an occurrence of a series', async () => {
    await expect(setup.execute(base)).rejects.toThrow('Choose the delete scope');
    expect(spies.transferRepository.deleteTransfer).not.toHaveBeenCalled();
  });

  it('SHOULD delete only this occurrence WHEN the scope is ONLY_THIS', async () => {
    await setup.execute({ ...base, scope: 'ONLY_THIS' as never });

    expect(spies.transferRepository.deleteTransfer).toHaveBeenCalledWith(mocks.transfer.id);
    expect(spies.transferRepository.deleteTransferSeriesFrom).not.toHaveBeenCalled();
  });

  it('SHOULD delete this and the next occurrences AND end the series the day before WHEN the scope is THIS_AND_NEXT', async () => {
    await setup.execute({ ...base, scope: 'THIS_AND_NEXT' as never });

    expect(spies.transferRepository.deleteTransferSeriesFrom).toHaveBeenCalledWith({
      deleteSeries: false,
      endDate: '2026-10-04',
      fromNumber: 3,
      lastGeneratedNumber: 2,
      recurrenceId: 'series-1',
    });
    expect(spies.gate.invalidate).toHaveBeenCalledWith([expect.any(String)]);
  });

  it('SHOULD remove the whole series WHEN the first occurrence is deleted with THIS_AND_NEXT', async () => {
    spies.getTransfer.execute.mockResolvedValue({ ...occurrence, occurrenceNumber: 1 });

    await setup.execute({ ...base, scope: 'THIS_AND_NEXT' as never });

    expect(spies.transferRepository.deleteTransferSeriesFrom).toHaveBeenCalledWith(
      expect.objectContaining({ deleteSeries: true, fromNumber: 1 }),
    );
  });
});
