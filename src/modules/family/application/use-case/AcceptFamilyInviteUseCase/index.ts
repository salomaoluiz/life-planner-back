import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  NotFoundException,
} from '@nestjs/common';

import { AcceptFamilyInviteInput, emailsMatch } from '@family/application/dto/FamilyInvite';
import {
  FamilyMemberUseCaseOutput,
  isInviteExpired,
  toFamilyMemberUseCaseOutput,
} from '@family/application/dto/FamilyMemberOutput';
import { IFamilyMemberRepository, IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { hashToken } from '@shared/infra/token';

export class AcceptFamilyInviteUseCase implements UseCaseWithParams<
  AcceptFamilyInviteInput,
  FamilyMemberUseCaseOutput
> {
  constructor(
    @Inject('IFamilyMemberRepository')
    private readonly familyMemberRepository: IFamilyMemberRepository,
    @Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository,
  ) {}

  async execute(params: AcceptFamilyInviteInput): Promise<FamilyMemberUseCaseOutput> {
    const invite = await this.familyMemberRepository.findByTokenHash(hashToken(params.token));

    if (!invite) {
      throw new NotFoundException('INVITE_NOT_FOUND');
    }

    if (isInviteExpired(invite)) {
      throw new GoneException('INVITE_EXPIRED');
    }

    if (!emailsMatch(invite.email, params.userEmail)) {
      throw new ForbiddenException('INVITE_EMAIL_MISMATCH');
    }

    const existing = await this.familyMemberRepository.findMembership({
      familyId: invite.familyId,
      userId: params.userId,
    });

    if (existing) {
      throw new ConflictException('FAMILY_MEMBER_ALREADY_EXISTS');
    }

    const family = await this.familyRepository.getFamilyById(invite.familyId);

    if (!family) {
      throw new NotFoundException('INVITE_NOT_FOUND');
    }

    // joinedAt is server time. The repository update only matches a still-pending row, so of two
    // concurrent accepts exactly one gets a result; the other sees `undefined`.
    const joined = await this.familyMemberRepository.join({
      id: invite.id,
      joinedAt: new Date(),
      userId: params.userId,
    });

    if (!joined) {
      throw new NotFoundException('INVITE_NOT_FOUND');
    }

    return toFamilyMemberUseCaseOutput(joined, family.ownerId);
  }
}
