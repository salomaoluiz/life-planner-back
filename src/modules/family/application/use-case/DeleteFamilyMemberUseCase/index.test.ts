import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

function given(row: { id: string }) {
  mocks.familyMemberRepository.findById.mockResolvedValue(row);
}

describe('GIVEN the family owner', () => {
  it.each([
    ['a joined member', 'member'],
    ['a pending invite (cancel)', 'pending'],
  ] as const)('SHOULD delete %s', async (_label, key) => {
    given(mocks.rows[key]);

    await setup.execute({ memberId: mocks.rows[key].id, userId: mocks.ids.owner });

    expect(mocks.familyMemberRepository.deleteById).toHaveBeenCalledWith(mocks.rows[key].id);
  });

  it('SHOULD refuse (409 FAMILY_OWNER_CANNOT_BE_REMOVED) to delete their own row', async () => {
    given(mocks.rows.owner);

    await expect(setup.execute({ memberId: 'owner-row', userId: mocks.ids.owner })).rejects.toThrow(
      new ConflictException('FAMILY_OWNER_CANNOT_BE_REMOVED'),
    );
    expect(mocks.familyMemberRepository.deleteById).not.toHaveBeenCalled();
  });
});

describe('GIVEN a non-owner member', () => {
  it('SHOULD be able to leave (delete their own row)', async () => {
    given(mocks.rows.member);

    await setup.execute({ memberId: 'member-row', userId: mocks.ids.member });

    expect(mocks.familyMemberRepository.deleteById).toHaveBeenCalledWith('member-row');
  });

  it.each([
    ['another member', 'other'],
    ['a pending invite', 'pending'],
    ['the owner row', 'owner'],
  ] as const)('SHOULD get 403 trying to delete %s', async (_label, key) => {
    given(mocks.rows[key]);

    await expect(
      setup.execute({ memberId: mocks.rows[key].id, userId: mocks.ids.member }),
    ).rejects.toThrow(ForbiddenException);
    expect(mocks.familyMemberRepository.deleteById).not.toHaveBeenCalled();
  });
});

describe('GIVEN a stranger or an unknown id', () => {
  it('SHOULD get 404 WHEN the member id does not exist', async () => {
    mocks.familyMemberRepository.findById.mockResolvedValue(undefined);

    await expect(setup.execute({ memberId: 'nope', userId: mocks.ids.owner })).rejects.toThrow(
      NotFoundException,
    );
    expect(mocks.getFamilyByIdUseCase.execute).not.toHaveBeenCalled();
  });

  it('SHOULD get 404 (not 403) WHEN the caller is not a member of that family', async () => {
    given(mocks.rows.member);
    mocks.getFamilyByIdUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.execute({ memberId: 'member-row', userId: 'stranger' })).rejects.toThrow(
      NotFoundException,
    );
    expect(mocks.getFamilyByIdUseCase.execute).toHaveBeenCalledWith({
      familyId: mocks.family.id,
      userId: 'stranger',
    });
    expect(mocks.familyMemberRepository.deleteById).not.toHaveBeenCalled();
  });
});
