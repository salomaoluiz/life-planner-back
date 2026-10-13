import { Inject } from '@nestjs/common';

import { FamilyAccessInput } from '@family/application/dto/FamilyAccess';
import {
  FamilyMemberUseCaseOutput,
  toFamilyMemberUseCaseOutput,
} from '@family/application/dto/FamilyMemberOutput';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { FamilyMemberRole, FamilyMemberStatus } from '@family/domain/enum';
import { IFamilyMemberRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class GetFamilyMembersUseCase implements UseCaseWithParams<
  FamilyAccessInput,
  FamilyMemberUseCaseOutput[]
> {
  constructor(
    @Inject(GetFamilyByIdUseCase) private readonly getFamilyByIdUseCase: GetFamilyByIdUseCase,
    @Inject('IFamilyMemberRepository')
    private readonly familyMemberRepository: IFamilyMemberRepository,
  ) {}

  async execute(params: FamilyAccessInput): Promise<FamilyMemberUseCaseOutput[]> {
    // 404 for non-members and pending invitees: only JOINED members may read the list.
    const family = await this.getFamilyByIdUseCase.execute(params);

    const members = await this.familyMemberRepository.findByFamilyId(family.id);
    const now = new Date();

    return members
      .map((member) => toFamilyMemberUseCaseOutput(member, family.ownerId, now))
      .sort((a, b) => rank(a) - rank(b) || sortKey(a) - sortKey(b));
  }
}

function rank(member: FamilyMemberUseCaseOutput): number {
  if (member.role === FamilyMemberRole.OWNER) {
    return 0;
  }

  return member.status === FamilyMemberStatus.JOINED ? 1 : 2;
}
function sortKey(member: FamilyMemberUseCaseOutput): number {
  const date =
    member.status === FamilyMemberStatus.JOINED
      ? (member.joinedAt ?? member.createdAt)
      : member.createdAt;

  return date.getTime();
}
