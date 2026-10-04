import { Inject, Injectable } from '@nestjs/common';

import {
  FamilyInvitePreviewOutput,
  FamilyMemberOutput,
  InviteFamilyMemberInput,
  InviteFamilyMemberOutput,
} from '@api/family-member/v1/dto/family-member.dto';
import { FamilyMemberUseCaseOutput } from '@family/application/dto/FamilyMemberOutput';
import { AcceptFamilyInviteUseCase } from '@family/application/use-case/AcceptFamilyInviteUseCase';
import { DeleteFamilyMemberUseCase } from '@family/application/use-case/DeleteFamilyMemberUseCase';
import { GetFamilyInvitePreviewUseCase } from '@family/application/use-case/GetFamilyInvitePreviewUseCase';
import { GetFamilyMembersUseCase } from '@family/application/use-case/GetFamilyMembersUseCase';
import { InviteFamilyMemberUseCase } from '@family/application/use-case/InviteFamilyMemberUseCase';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';
import { FindUsersByIdsUseCase } from '@user/application/use-case/FindUsersByIdsUseCase';

type UserSummary = { name: string; photoUrl?: string };

// Explicit projection: only name and photoUrl of a user ever reach the response.
function toApiMember(
  member: FamilyMemberUseCaseOutput,
  user: undefined | UserSummary,
): FamilyMemberOutput {
  return {
    email: member.email,
    familyId: member.familyId,
    id: member.id,
    inviteExpired: member.inviteExpired,
    joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
    role: member.role,
    status: member.status,
    user: user ? { name: user.name, photoUrl: user.photoUrl ?? null } : null,
    userId: member.userId ?? null,
  };
}

@Injectable()
export class FamilyMemberService {
  constructor(
    private readonly acceptFamilyInviteUseCase: AcceptFamilyInviteUseCase,
    private readonly deleteFamilyMemberUseCase: DeleteFamilyMemberUseCase,
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly findUsersByIdsUseCase: FindUsersByIdsUseCase,
    private readonly getFamilyInvitePreviewUseCase: GetFamilyInvitePreviewUseCase,
    private readonly getFamilyMembersUseCase: GetFamilyMembersUseCase,
    private readonly inviteFamilyMemberUseCase: InviteFamilyMemberUseCase,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  async accept(userId: string, token: string): Promise<FamilyMemberOutput> {
    // The family module cannot import the user module, so the caller email is resolved here.
    const user = await this.findUserByIdUseCase.execute({ id: userId });

    const member = await this.acceptFamilyInviteUseCase.execute({
      token,
      userEmail: user.email,
      userId,
    });

    return toApiMember(member, { name: user.name, photoUrl: user.photoUrl });
  }

  async delete(userId: string, memberId: string): Promise<void> {
    await this.deleteFamilyMemberUseCase.execute({ memberId, userId });
  }

  async findAll(userId: string, familyId: string): Promise<FamilyMemberOutput[]> {
    const members = await this.getFamilyMembersUseCase.execute({ familyId, userId });

    const users = await this.findUserSummaries(
      familyId,
      members.flatMap((member) => (member.userId ? [member.userId] : [])),
    );

    return members.map((member) =>
      toApiMember(member, member.userId ? users.get(member.userId) : undefined),
    );
  }

  async invite(
    userId: string,
    familyId: string,
    input: InviteFamilyMemberInput,
  ): Promise<InviteFamilyMemberOutput> {
    const result = await this.inviteFamilyMemberUseCase.execute({
      email: input.email,
      familyId,
      userId,
    });

    return {
      inviteExpiresAt: result.inviteExpiresAt.toISOString(),
      inviteToken: result.inviteToken,
      member: toApiMember(result.member, undefined),
    };
  }

  async preview(userId: string, token: string): Promise<FamilyInvitePreviewOutput> {
    const user = await this.findUserByIdUseCase.execute({ id: userId });

    const preview = await this.getFamilyInvitePreviewUseCase.execute({
      token,
      userEmail: user.email,
    });

    return {
      email: preview.email,
      emailMatches: preview.emailMatches,
      familyId: preview.familyId,
      familyName: preview.familyName,
      inviteExpiresAt: preview.inviteExpiresAt.toISOString(),
    };
  }

  // A failing lookup must never fail the list: members then simply come back with user: null.
  private async findUserSummaries(
    familyId: string,
    ids: string[],
  ): Promise<Map<string, UserSummary>> {
    if (ids.length === 0) {
      return new Map();
    }

    try {
      const users = await this.findUsersByIdsUseCase.execute({ ids });

      return new Map(users.map((user) => [user.id, { name: user.name, photoUrl: user.photoUrl }]));
    } catch {
      this.logger.log(LogLevel.WARN, 'User summaries unavailable for family members', {
        familyId,
        module: 'FamilyMemberService',
      });

      return new Map();
    }
  }
}
