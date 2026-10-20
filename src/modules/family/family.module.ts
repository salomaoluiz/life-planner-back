import { Module } from '@nestjs/common';

import { AcceptFamilyInviteUseCase } from '@family/application/use-case/AcceptFamilyInviteUseCase';
import { CheckFamilyMembershipUseCase } from '@family/application/use-case/CheckFamilyMembershipUseCase';
import { CreateFamilyUseCase } from '@family/application/use-case/CreateFamilyUseCase';
import { DeleteFamilyMemberUseCase } from '@family/application/use-case/DeleteFamilyMemberUseCase';
import { DeleteFamilyUseCase } from '@family/application/use-case/DeleteFamilyUseCase';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { GetFamilyInvitePreviewUseCase } from '@family/application/use-case/GetFamilyInvitePreviewUseCase';
import { GetFamilyMembersUseCase } from '@family/application/use-case/GetFamilyMembersUseCase';
import { GetOwnedFamilyIdsUseCase } from '@family/application/use-case/GetOwnedFamilyIdsUseCase';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { GetUserFamilyIdsUseCase } from '@family/application/use-case/GetUserFamilyIdsUseCase';
import { InviteFamilyMemberUseCase } from '@family/application/use-case/InviteFamilyMemberUseCase';
import { RemoveUserFromFamiliesUseCase } from '@family/application/use-case/RemoveUserFromFamiliesUseCase';
import { UpdateFamilyUseCase } from '@family/application/use-case/UpdateFamilyUseCase';
import { FamilyDatasource } from '@family/data/datasource/FamilyDatasource';
import { FamilyMemberDatasource } from '@family/data/datasource/FamilyMemberDatasource';
import { FamilyMemberRepository } from '@family/data/repository/FamilyMemberRepository';
import { FamilyRepository } from '@family/data/repository/FamilyRepository';

const useCases = [
  AcceptFamilyInviteUseCase,
  CheckFamilyMembershipUseCase,
  CreateFamilyUseCase,
  DeleteFamilyMemberUseCase,
  DeleteFamilyUseCase,
  EnsureFamilyOwnerUseCase,
  GetFamilyByIdUseCase,
  GetFamilyInvitePreviewUseCase,
  GetFamilyMembersUseCase,
  GetOwnedFamilyIdsUseCase,
  GetUserFamiliesUseCase,
  GetUserFamilyAccessUseCase,
  GetUserFamilyIdsUseCase,
  InviteFamilyMemberUseCase,
  RemoveUserFromFamiliesUseCase,
  UpdateFamilyUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    { provide: 'IFamilyRepository', useClass: FamilyRepository },
    { provide: 'IFamilyDatasource', useClass: FamilyDatasource },
    { provide: 'IFamilyMemberRepository', useClass: FamilyMemberRepository },
    { provide: 'IFamilyMemberDatasource', useClass: FamilyMemberDatasource },
  ],
})
export class FamilyModule {}
