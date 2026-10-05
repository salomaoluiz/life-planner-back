import { ConflictException, Inject } from '@nestjs/common';

import {
  INVITE_TTL_MS,
  toFamilyMemberUseCaseOutput,
} from '@family/application/dto/FamilyMemberOutput';
import {
  InviteFamilyMemberInput,
  InviteFamilyMemberOutput,
  InviteFamilyMemberSchema,
} from '@family/application/dto/InviteFamilyMember';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { IFamilyMemberRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { generateToken, hashToken } from '@shared/infra/token';
import { validate } from '@shared/infra/validation';

export class InviteFamilyMemberUseCase implements UseCaseWithParams<
  InviteFamilyMemberInput,
  InviteFamilyMemberOutput
> {
  constructor(
    @Inject(EnsureFamilyOwnerUseCase)
    private readonly ensureFamilyOwnerUseCase: EnsureFamilyOwnerUseCase,
    @Inject('IFamilyMemberRepository')
    private readonly familyMemberRepository: IFamilyMemberRepository,
  ) {}

  async execute(params: InviteFamilyMemberInput): Promise<InviteFamilyMemberOutput> {
    const input = validate(InviteFamilyMemberSchema, params);

    // Throws NotFoundException for non-members, then ForbiddenException for non-owners.
    const family = await this.ensureFamilyOwnerUseCase.execute({
      familyId: input.familyId,
      userId: input.userId,
    });

    const existing = await this.familyMemberRepository.findByEmail({
      email: input.email,
      familyId: input.familyId,
    });

    if (existing) {
      throw new ConflictException('FAMILY_MEMBER_ALREADY_EXISTS');
    }

    // Only the hash is persisted; the raw token is returned once and never stored.
    const inviteToken = generateToken();
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const member = await this.familyMemberRepository.createInvite({
      email: input.email,
      familyId: input.familyId,
      inviteExpiresAt,
      tokenHash: hashToken(inviteToken),
    });

    // Lost the unique-constraint race against a concurrent invite for the same email.
    if (!member) {
      throw new ConflictException('FAMILY_MEMBER_ALREADY_EXISTS');
    }

    return {
      inviteExpiresAt,
      inviteToken,
      member: toFamilyMemberUseCaseOutput(member, family.ownerId),
    };
  }
}
