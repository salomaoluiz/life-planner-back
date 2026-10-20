import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { FamilyStatus } from '@family/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './family.service.mocks';

describe('create', () => {
  it('SHOULD look up the JWT user email AND create the family owned by the JWT user', async () => {
    const result = await setup.create(mocks.userId, { name: 'Example Family' });

    expect(mocks.findUserByIdUseCase.execute).toHaveBeenCalledWith({ id: mocks.userId });
    expect(mocks.createFamilyUseCase.execute).toHaveBeenCalledWith({
      name: 'Example Family',
      ownerEmail: 'test@example.com',
      ownerId: mocks.userId,
    });
    expect(result).toEqual(mocks.familyApi);
  });

  it('SHOULD ignore a client-supplied ownerId/userId in the body', async () => {
    const spoofed = { name: 'Example Family', ownerId: 'someone-else' } as { name: string };

    await setup.create(mocks.userId, spoofed);

    expect(mocks.createFamilyUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: mocks.userId }),
    );
  });

  it('SHOULD add the new family to the scopes of the creator All categories', async () => {
    await setup.create(mocks.userId, { name: 'Example Family' });

    expect(mocks.addFamilyToCategoryScopes.execute).toHaveBeenCalledWith({
      familyId: mocks.familyId,
      userId: mocks.userId,
    });
  });

  it('SHOULD propagate NotFoundException WHEN the JWT user no longer exists AND create nothing', async () => {
    mocks.findUserByIdUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.create(mocks.userId, { name: 'x' })).rejects.toThrow(NotFoundException);
    expect(mocks.createFamilyUseCase.execute).not.toHaveBeenCalled();
  });
});

describe('findAll', () => {
  it('SHOULD return the user families with ISO dates AND only public fields', async () => {
    const result = await setup.findAll(mocks.userId);

    expect(mocks.getUserFamiliesUseCase.execute).toHaveBeenCalledWith({ userId: mocks.userId });
    expect(result).toEqual([mocks.familyApi]);
  });

  it('SHOULD return an empty array WHEN the user has no family', async () => {
    mocks.getUserFamiliesUseCase.execute.mockResolvedValueOnce([]);

    expect(await setup.findAll(mocks.userId)).toEqual([]);
  });
});

describe('findById', () => {
  it('SHOULD return the family', async () => {
    const result = await setup.findById(mocks.userId, mocks.familyId);

    expect(mocks.getFamilyByIdUseCase.execute).toHaveBeenCalledWith({
      familyId: mocks.familyId,
      userId: mocks.userId,
    });
    expect(result).toEqual(mocks.familyApi);
  });
});

describe('update', () => {
  it('SHOULD rename the family AND return it', async () => {
    const result = await setup.update(mocks.userId, mocks.familyId, { name: 'Renamed' });

    expect(mocks.updateFamilyUseCase.execute).toHaveBeenCalledWith({
      familyId: mocks.familyId,
      name: 'Renamed',
      status: undefined,
      userId: mocks.userId,
    });
    expect(result).toEqual(mocks.familyApi);
  });

  describe('archive (spec 042)', () => {
    const archive = { status: FamilyStatus.ARCHIVED };

    it('SHOULD archive WHEN nothing is pending, without asking for blockers on reactivate', async () => {
      await setup.update(mocks.userId, mocks.familyId, archive);

      expect(mocks.updateFamilyUseCase.execute).toHaveBeenCalledWith({
        familyId: mocks.familyId,
        name: undefined,
        status: FamilyStatus.ARCHIVED,
        userId: mocks.userId,
      });

      mocks.getFamilyArchiveBlockersUseCase.execute.mockClear();
      await setup.update(mocks.userId, mocks.familyId, { status: FamilyStatus.ACTIVE });

      expect(mocks.getFamilyArchiveBlockersUseCase.execute).not.toHaveBeenCalled();
    });

    it('SHOULD answer 409 with the blockers, the counts AND the pending invites, writing nothing', async () => {
      mocks.getFamilyArchiveBlockersUseCase.execute.mockResolvedValueOnce({
        ...mocks.noBlockers,
        counts: { ...mocks.noBlockers.counts, recurrences: 1 },
        recurrences: [{ description: 'Rent', id: 'rec-1', nextOccurrenceDate: '2026-11-05' }],
      });
      mocks.getFamilyPendingInvitesUseCase.execute.mockResolvedValueOnce([
        { email: 'test@example.com', id: 'invite-1' },
      ]);

      const error = await setup.update(mocks.userId, mocks.familyId, archive).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual({
        blockers: {
          installmentPlans: [],
          invoices: [],
          pendingInvites: [{ email: 'test@example.com', id: 'invite-1' }],
          recurrences: [{ description: 'Rent', id: 'rec-1', nextOccurrenceDate: '2026-11-05' }],
          unpaidTransactions: [],
        },
        counts: {
          installmentPlans: 0,
          invoices: 0,
          pendingInvites: 1,
          recurrences: 1,
          unpaidTransactions: 0,
        },
        message: 'Family has pending items',
      });
      expect(mocks.updateFamilyUseCase.execute).not.toHaveBeenCalled();
    });

    it('SHOULD answer 409 WHEN only a pending invite blocks', async () => {
      mocks.getFamilyPendingInvitesUseCase.execute.mockResolvedValueOnce([
        { email: 'test@example.com', id: 'invite-1' },
      ]);

      await expect(setup.update(mocks.userId, mocks.familyId, archive)).rejects.toThrow(
        'Family has pending items',
      );
    });

    it('SHOULD be idempotent WHEN the family is already archived (no blockers check)', async () => {
      mocks.ensureFamilyOwnerUseCase.execute.mockResolvedValueOnce({
        ...mocks.familyResult,
        status: FamilyStatus.ARCHIVED,
      });

      await setup.update(mocks.userId, mocks.familyId, archive);

      expect(mocks.getFamilyArchiveBlockersUseCase.execute).not.toHaveBeenCalled();
      expect(mocks.updateFamilyUseCase.execute).toHaveBeenCalled();
    });

    it('SHOULD propagate the non-owner error BEFORE computing blockers', async () => {
      mocks.ensureFamilyOwnerUseCase.execute.mockRejectedValueOnce(new ForbiddenException());

      await expect(setup.update(mocks.userId, mocks.familyId, archive)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mocks.getFamilyArchiveBlockersUseCase.execute).not.toHaveBeenCalled();
    });
  });
});

describe('delete', () => {
  const ownerParams = { familyId: mocks.familyId, userId: mocks.userId };

  it('SHOULD verify the owner, run every records check AND then delete', async () => {
    await setup.delete(mocks.userId, mocks.familyId);

    expect(mocks.ensureFamilyOwnerUseCase.execute).toHaveBeenCalledWith(ownerParams);
    expect(mocks.recordsCheck.execute).toHaveBeenCalledWith({
      owner: OwnerType.FAMILY,
      ownerId: mocks.familyId,
    });
    expect(mocks.deleteFamilyUseCase.execute).toHaveBeenCalledWith(ownerParams);
  });

  it('SHOULD remove the family from the All category scopes AFTER deleting it', async () => {
    await setup.delete(mocks.userId, mocks.familyId);

    expect(mocks.removeFamilyFromCategoryScopes.execute).toHaveBeenCalledWith({
      familyId: mocks.familyId,
    });
    expect(
      mocks.removeFamilyFromCategoryScopes.execute.mock.invocationCallOrder[0],
    ).toBeGreaterThan(mocks.deleteFamilyUseCase.execute.mock.invocationCallOrder[0]);
  });

  it('SHOULD NOT touch the scopes WHEN the family is not deleted', async () => {
    mocks.recordsCheck.execute.mockResolvedValueOnce(true);

    await expect(setup.delete(mocks.userId, mocks.familyId)).rejects.toThrow();
    expect(mocks.removeFamilyFromCategoryScopes.execute).not.toHaveBeenCalled();
  });

  it('SHOULD throw ConflictException "Family still owns records" AND delete nothing WHEN a check returns true', async () => {
    mocks.recordsCheck.execute.mockResolvedValueOnce(true);

    const promise = setup.delete(mocks.userId, mocks.familyId);

    await expect(promise).rejects.toThrow(ConflictException);
    await expect(promise).rejects.toThrow('Family still owns records');
    expect(mocks.deleteFamilyUseCase.execute).not.toHaveBeenCalled();
  });

  it('SHOULD throw ForbiddenException (NOT Conflict) WHEN a non-owner member deletes a family that owns records', async () => {
    mocks.ensureFamilyOwnerUseCase.execute.mockRejectedValueOnce(new ForbiddenException());
    mocks.recordsCheck.execute.mockResolvedValue(true);

    await expect(setup.delete(mocks.userId, mocks.familyId)).rejects.toThrow(ForbiddenException);
    expect(mocks.recordsCheck.execute).not.toHaveBeenCalled();
    expect(mocks.deleteFamilyUseCase.execute).not.toHaveBeenCalled();
  });

  it('SHOULD throw NotFoundException BEFORE running any check WHEN the caller is not a member', async () => {
    mocks.ensureFamilyOwnerUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.delete(mocks.userId, mocks.familyId)).rejects.toThrow(NotFoundException);
    expect(mocks.recordsCheck.execute).not.toHaveBeenCalled();
  });
});
