import { ConflictException, ForbiddenException, Inject, NotFoundException } from '@nestjs/common';

import { ensureFamilyWritable } from '@family/application/service/FamilyWritable';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { IFamilyMemberRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export type DeleteFamilyMemberInput = {
  memberId: string;
  userId: string;
};

// Returns the removed row's family and user (`userId` is undefined for a pending invite).
export type DeleteFamilyMemberOutput = { familyId: string; userId?: string };

export class DeleteFamilyMemberUseCase implements UseCaseWithParams<
  DeleteFamilyMemberInput,
  DeleteFamilyMemberOutput
> {
  constructor(
    @Inject(GetFamilyByIdUseCase) private readonly getFamilyByIdUseCase: GetFamilyByIdUseCase,
    @Inject('IFamilyMemberRepository')
    private readonly familyMemberRepository: IFamilyMemberRepository,
  ) {}

  async execute(params: DeleteFamilyMemberInput): Promise<DeleteFamilyMemberOutput> {
    const member = await this.familyMemberRepository.findById(params.memberId);

    if (!member) {
      throw new NotFoundException();
    }

    // Callers outside the family get 404 so member ids cannot be probed.
    const family = await this.getFamilyByIdUseCase.execute({
      familyId: member.familyId,
      userId: params.userId,
    });

    const isOwner = family.ownerId === params.userId;

    if (member.userId === family.ownerId) {
      throw isOwner
        ? new ConflictException('FAMILY_OWNER_CANNOT_BE_REMOVED')
        : new ForbiddenException();
    }

    const isOwnRow = member.userId === params.userId;

    // The owner may remove/cancel any other row; a member may only leave (own row).
    if (!isOwner && !isOwnRow) {
      throw new ForbiddenException();
    }

    // A member may still leave an archived family; the owner cannot remove others from it (spec 042).
    if (!isOwnRow) {
      ensureFamilyWritable(family);
    }

    await this.familyMemberRepository.deleteById(member.id);

    return { familyId: member.familyId, userId: member.userId };
  }
}
