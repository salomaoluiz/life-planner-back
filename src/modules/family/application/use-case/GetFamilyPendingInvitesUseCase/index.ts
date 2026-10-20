import { Inject } from '@nestjs/common';

import { IFamilyMemberRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface PendingInvite {
  email: string;
  id: string;
}

// Spec 042 FR 3: pending invites (not yet accepted, expired ones included: the owner can still cancel them)
// block the archive. The caller must already have checked that the user owns the family.
export class GetFamilyPendingInvitesUseCase implements UseCaseWithParams<
  { familyId: string },
  PendingInvite[]
> {
  constructor(
    @Inject('IFamilyMemberRepository')
    private readonly familyMemberRepository: IFamilyMemberRepository,
  ) {}

  async execute(params: { familyId: string }): Promise<PendingInvite[]> {
    const members = await this.familyMemberRepository.findByFamilyId(params.familyId);

    return members
      .filter((member) => !member.userId)
      .map((member) => ({ email: member.email, id: member.id }));
  }
}
