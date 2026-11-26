import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

const base = {
  families: undefined,
  memberFamilyIds: ['family-1'],
  tickMinutes: 15,
  userId: 'user-1',
};

it('SHOULD save only the fields that were sent AND return the families turned off', async () => {
  mocks.notificationPreferenceRepository.findDisabledFamilyIds.mockResolvedValue(
    new Map([['user-1', new Set(['family-1'])]]),
  );

  const result = await setup.execute({
    ...base,
    patch: { billLeadDays: 5, invoiceLeadDays: undefined },
  });

  expect(mocks.notificationPreferenceRepository.save).toHaveBeenCalledWith('user-1', {
    billLeadDays: 5,
  });
  expect(result.preferences.billLeadDays).toBe(5);
  expect(result.disabledFamilyIds).toEqual(['family-1']);
});

it('SHOULD NOT write the preferences WHEN only families change AND set each family switch', async () => {
  await setup.execute({ ...base, families: [{ enabled: false, familyId: 'family-1' }], patch: {} });

  expect(mocks.notificationPreferenceRepository.save).not.toHaveBeenCalled();
  expect(mocks.notificationPreferenceRepository.setFamilyEnabled).toHaveBeenCalledWith(
    'user-1',
    'family-1',
    false,
  );
});

it("SHOULD answer 404 WHEN a family is not one of the user's active families", async () => {
  await expect(
    setup.execute({ ...base, families: [{ enabled: false, familyId: 'stranger' }], patch: {} }),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(mocks.notificationPreferenceRepository.setFamilyEnabled).not.toHaveBeenCalled();
});

it('SHOULD answer 422 with the copy of FR 13 WHEN the summary time falls inside quiet hours', async () => {
  await expect(setup.execute({ ...base, patch: { summaryMinute: 1380 } })).rejects.toThrow(
    new UnprocessableEntityException('Escolha um horário fora do silêncio'),
  );
});

it('SHOULD check the summary against the QUIET hours being sent too', async () => {
  await expect(
    setup.execute({ ...base, patch: { quietEndMinute: 540, quietStartMinute: 420 } }),
  ).rejects.toBeInstanceOf(UnprocessableEntityException);
});

it('SHOULD answer 400 WHEN the summary time is not a multiple of the tick', async () => {
  await expect(setup.execute({ ...base, patch: { summaryMinute: 490 } })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

it('SHOULD answer 400 WHEN the time zone is unknown', async () => {
  await expect(setup.execute({ ...base, patch: { timeZone: 'Mars/Base' } })).rejects.toBeInstanceOf(
    ValidationError,
  );
});
