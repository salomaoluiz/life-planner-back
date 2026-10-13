import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD order owner first, then joined by joinedAt asc, then pending by createdAt asc', async () => {
  const result = await setup.execute(mocks.input);

  expect(result.map((member) => member.id)).toEqual([
    'owner-row',
    'joined-early',
    'joined-late',
    'pending-old',
    'pending-new',
  ]);
});

it('SHOULD derive role, status AND inviteExpired per row', async () => {
  const result = await setup.execute(mocks.input);

  expect(result.map((m) => [m.id, m.role, m.status, m.inviteExpired])).toEqual([
    ['owner-row', 'OWNER', 'JOINED', false],
    ['joined-early', 'MEMBER', 'JOINED', false],
    ['joined-late', 'MEMBER', 'JOINED', false],
    ['pending-old', 'MEMBER', 'PENDING', false],
    ['pending-new', 'MEMBER', 'PENDING', true],
  ]);
});

it('SHOULD check membership first AND query the members of that family only', async () => {
  await setup.execute(mocks.input);

  expect(mocks.getFamilyByIdUseCase.execute).toHaveBeenCalledWith(mocks.input);
  expect(mocks.familyMemberRepository.findByFamilyId).toHaveBeenCalledWith(mocks.family.id);
});

it('SHOULD propagate NotFoundException for a stranger / pending invitee AND NOT read any member', async () => {
  mocks.getFamilyByIdUseCase.execute.mockRejectedValueOnce(new NotFoundException());

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
  expect(mocks.familyMemberRepository.findByFamilyId).not.toHaveBeenCalled();
});

it('SHOULD return [] WHEN the family has no rows', async () => {
  mocks.familyMemberRepository.findByFamilyId.mockResolvedValueOnce([]);

  expect(await setup.execute(mocks.input)).toEqual([]);
});

it('SHOULD NOT mutate the array returned by the repository', async () => {
  const rows = await mocks.familyMemberRepository.findByFamilyId();
  const before = rows.map((row: { id: string }) => row.id);
  mocks.familyMemberRepository.findByFamilyId.mockResolvedValueOnce(rows);

  await setup.execute(mocks.input);

  expect(rows.map((row: { id: string }) => row.id)).toEqual(before);
});
