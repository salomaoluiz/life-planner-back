import { GoneException, Inject, NotFoundException } from '@nestjs/common';

import {
  emailsMatch,
  FamilyInvitePreviewInput,
  FamilyInvitePreviewOutput,
} from '@family/application/dto/FamilyInvite';
import { isInviteExpired } from '@family/application/dto/FamilyMemberOutput';
import { IFamilyMemberRepository, IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { hashToken } from '@shared/infra/token';

export class GetFamilyInvitePreviewUseCase implements UseCaseWithParams<
  FamilyInvitePreviewInput,
  FamilyInvitePreviewOutput
> {
  constructor(
    @Inject('IFamilyMemberRepository')
    private readonly familyMemberRepository: IFamilyMemberRepository,
    @Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository,
  ) {}

  async execute(params: FamilyInvitePreviewInput): Promise<FamilyInvitePreviewOutput> {
    const member = await this.familyMemberRepository.findByTokenHash(hashToken(params.token));

    if (!member) {
      throw new NotFoundException('INVITE_NOT_FOUND');
    }

    const { inviteExpiresAt } = member;

    // Also covers a (never expected) token row without an expiry date: fail closed.
    if (!inviteExpiresAt || isInviteExpired(member)) {
      throw new GoneException('INVITE_EXPIRED');
    }

    const family = await this.familyRepository.getFamilyById(member.familyId);

    if (!family) {
      throw new NotFoundException('INVITE_NOT_FOUND');
    }

    return {
      email: member.email,
      emailMatches: emailsMatch(member.email, params.userEmail),
      familyId: family.id,
      familyName: family.name,
      inviteExpiresAt,
    };
  }
}
