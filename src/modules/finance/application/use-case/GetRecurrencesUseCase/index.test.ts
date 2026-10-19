import { RecurrenceStatus } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

describe('GetRecurrencesUseCase', () => {
  it('SHOULD list the series of every accessible owner with the filter', async () => {
    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      accountId: 'account-1',
      status: RecurrenceStatus.ACTIVE,
    });

    expect(result).toEqual(mocks.recurrences);
    expect(mocks.recurrenceRepository.findByOwners).toHaveBeenCalledWith(mocks.accessibleOwners, {
      accountId: 'account-1',
      creditCardId: undefined,
      status: RecurrenceStatus.ACTIVE,
    });
  });

  it('SHOULD narrow to the requested owners', async () => {
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['family-id'] });

    expect(mocks.recurrenceRepository.findByOwners.mock.calls[0][0]).toEqual([
      mocks.accessibleOwners[1],
    ]);
  });

  it('SHOULD return nothing WHEN no requested owner is accessible', async () => {
    expect(
      await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['other'] }),
    ).toEqual([]);
    expect(mocks.recurrenceRepository.findByOwners).not.toHaveBeenCalled();
  });
});
