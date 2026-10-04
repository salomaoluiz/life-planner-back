import { Module } from '@nestjs/common';

import { CheckFamilyMembershipUseCase } from '@family/application/use-case/CheckFamilyMembershipUseCase';
import { CreateFamilyUseCase } from '@family/application/use-case/CreateFamilyUseCase';
import { DeleteFamilyUseCase } from '@family/application/use-case/DeleteFamilyUseCase';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { GetUserFamilyIdsUseCase } from '@family/application/use-case/GetUserFamilyIdsUseCase';
import { UpdateFamilyUseCase } from '@family/application/use-case/UpdateFamilyUseCase';
import { FamilyDatasource } from '@family/data/datasource/FamilyDatasource';
import { FamilyRepository } from '@family/data/repository/FamilyRepository';

const useCases = [
  CheckFamilyMembershipUseCase,
  CreateFamilyUseCase,
  DeleteFamilyUseCase,
  EnsureFamilyOwnerUseCase,
  GetFamilyByIdUseCase,
  GetUserFamiliesUseCase,
  GetUserFamilyIdsUseCase,
  UpdateFamilyUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    { provide: 'IFamilyRepository', useClass: FamilyRepository },
    { provide: 'IFamilyDatasource', useClass: FamilyDatasource },
  ],
})
export class FamilyModule {}
