import { ConflictException, Inject, Injectable } from '@nestjs/common';

import { CreateFamilyInput, FamilyOutput, UpdateFamilyInput } from '@api/family/v1/dto/family.dto';
import {
  FAMILY_OWNED_RECORDS_CHECKS,
  IOwnedRecordsCheck,
} from '@api/family/v1/family-records-checks';
import { FamilyUseCaseOutput } from '@family/application/dto/FamilyUseCaseOutput';
import { CreateFamilyUseCase } from '@family/application/use-case/CreateFamilyUseCase';
import { DeleteFamilyUseCase } from '@family/application/use-case/DeleteFamilyUseCase';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { UpdateFamilyUseCase } from '@family/application/use-case/UpdateFamilyUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';

function toApiOutput(family: FamilyUseCaseOutput): FamilyOutput {
  return {
    createdAt: family.createdAt.toISOString(),
    id: family.id,
    name: family.name,
    ownerId: family.ownerId,
    updatedAt: family.updatedAt.toISOString(),
  };
}

@Injectable()
export class FamilyService {
  constructor(
    private readonly createFamilyUseCase: CreateFamilyUseCase,
    private readonly deleteFamilyUseCase: DeleteFamilyUseCase,
    private readonly ensureFamilyOwnerUseCase: EnsureFamilyOwnerUseCase,
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly getFamilyByIdUseCase: GetFamilyByIdUseCase,
    private readonly getUserFamiliesUseCase: GetUserFamiliesUseCase,
    private readonly updateFamilyUseCase: UpdateFamilyUseCase,
    @Inject(FAMILY_OWNED_RECORDS_CHECKS)
    private readonly ownedRecordsChecks: IOwnedRecordsCheck[],
  ) {}

  async create(userId: string, input: CreateFamilyInput): Promise<FamilyOutput> {
    // The family module cannot import the user module, so the owner email is resolved here.
    const user = await this.findUserByIdUseCase.execute({ id: userId });

    const family = await this.createFamilyUseCase.execute({
      name: input.name,
      ownerEmail: user.email,
      ownerId: userId,
    });

    return toApiOutput(family);
  }

  async delete(userId: string, familyId: string): Promise<void> {
    // 404 (non-member) -> 403 (non-owner) -> 409 (still owns records) -> delete.
    await this.ensureFamilyOwnerUseCase.execute({ familyId, userId });

    const results = await Promise.all(
      this.ownedRecordsChecks.map(async (check) =>
        check.execute({ owner: OwnerType.FAMILY, ownerId: familyId }),
      ),
    );

    if (results.some(Boolean)) {
      throw new ConflictException('Family still owns records');
    }

    await this.deleteFamilyUseCase.execute({ familyId, userId });
  }

  async findAll(userId: string): Promise<FamilyOutput[]> {
    const families = await this.getUserFamiliesUseCase.execute({ userId });

    return families.map((family) => toApiOutput(family));
  }

  async findById(userId: string, familyId: string): Promise<FamilyOutput> {
    const family = await this.getFamilyByIdUseCase.execute({ familyId, userId });

    return toApiOutput(family);
  }

  async update(userId: string, familyId: string, input: UpdateFamilyInput): Promise<FamilyOutput> {
    const family = await this.updateFamilyUseCase.execute({
      familyId,
      name: input.name,
      userId,
    });

    return toApiOutput(family);
  }
}
