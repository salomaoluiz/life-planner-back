import { Module } from '@nestjs/common';

import { CheckFamilyMembershipUseCase } from '@family/application/use-case/CheckFamilyMembershipUseCase';
import { CreateFamilyUseCase } from '@family/application/use-case/CreateFamilyUseCase';
import { DeleteFamilyMemberUseCase } from '@family/application/use-case/DeleteFamilyMemberUseCase';
import { DeleteFamilyUseCase } from '@family/application/use-case/DeleteFamilyUseCase';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { GetFamilyMembersUseCase } from '@family/application/use-case/GetFamilyMembersUseCase';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { GetUserFamilyIdsUseCase } from '@family/application/use-case/GetUserFamilyIdsUseCase';
import { InviteFamilyMemberUseCase } from '@family/application/use-case/InviteFamilyMemberUseCase';
import { UpdateFamilyUseCase } from '@family/application/use-case/UpdateFamilyUseCase';
import { FamilyDatasource } from '@family/data/datasource/FamilyDatasource';
import { FamilyMemberDatasource } from '@family/data/datasource/FamilyMemberDatasource';
import { FamilyMemberRepository } from '@family/data/repository/FamilyMemberRepository';
import { FamilyRepository } from '@family/data/repository/FamilyRepository';

const useCases = [
  CheckFamilyMembershipUseCase,
  CreateFamilyUseCase,
  DeleteFamilyMemberUseCase,
  DeleteFamilyUseCase,
  EnsureFamilyOwnerUseCase,
  GetFamilyByIdUseCase,
  GetFamilyMembersUseCase,
  GetUserFamiliesUseCase,
  GetUserFamilyIdsUseCase,
  InviteFamilyMemberUseCase,
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
