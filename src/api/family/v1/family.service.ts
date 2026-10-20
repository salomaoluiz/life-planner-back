import { ConflictException, Inject, Injectable } from '@nestjs/common';

import { CreateFamilyInput, FamilyOutput, UpdateFamilyInput } from '@api/family/v1/dto/family.dto';
import {
  FAMILY_OWNED_RECORDS_CHECKS,
  IOwnedRecordsCheck,
} from '@api/family/v1/family-records-checks';
import { todayInSaoPaulo } from '@api/finance/v1/credit-card-today';
import { FamilyUseCaseOutput } from '@family/application/dto/FamilyUseCaseOutput';
import { CreateFamilyUseCase } from '@family/application/use-case/CreateFamilyUseCase';
import { DeleteFamilyUseCase } from '@family/application/use-case/DeleteFamilyUseCase';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { GetFamilyPendingInvitesUseCase } from '@family/application/use-case/GetFamilyPendingInvitesUseCase';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { UpdateFamilyUseCase } from '@family/application/use-case/UpdateFamilyUseCase';
import { FamilyStatus } from '@family/domain/enum';
import { AddFamilyToCategoryScopesUseCase } from '@finance/application/use-case/AddFamilyToCategoryScopesUseCase';
import { GetFamilyArchiveBlockersUseCase } from '@finance/application/use-case/GetFamilyArchiveBlockersUseCase';
import { RemoveFamilyFromCategoryScopesUseCase } from '@finance/application/use-case/RemoveFamilyFromCategoryScopesUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';

function toApiOutput(family: FamilyUseCaseOutput): FamilyOutput {
  return {
    createdAt: family.createdAt.toISOString(),
    id: family.id,
    name: family.name,
    ownerId: family.ownerId,
    status: family.status,
    updatedAt: family.updatedAt.toISOString(),
  };
}

@Injectable()
export class FamilyService {
  constructor(
    private readonly addFamilyToCategoryScopesUseCase: AddFamilyToCategoryScopesUseCase,
    private readonly createFamilyUseCase: CreateFamilyUseCase,
    private readonly deleteFamilyUseCase: DeleteFamilyUseCase,
    private readonly ensureFamilyOwnerUseCase: EnsureFamilyOwnerUseCase,
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly getFamilyArchiveBlockersUseCase: GetFamilyArchiveBlockersUseCase,
    private readonly getFamilyByIdUseCase: GetFamilyByIdUseCase,
    private readonly getFamilyPendingInvitesUseCase: GetFamilyPendingInvitesUseCase,
    private readonly getUserFamiliesUseCase: GetUserFamiliesUseCase,
    private readonly removeFamilyFromCategoryScopesUseCase: RemoveFamilyFromCategoryScopesUseCase,
    private readonly updateFamilyUseCase: UpdateFamilyUseCase,
    @Inject(FAMILY_OWNED_RECORDS_CHECKS)
    private readonly ownedRecordsChecks: IOwnedRecordsCheck[],
  ) {}

  private async assertNoPendingItems(userId: string, familyId: string): Promise<void> {
    // 404 (non-member) -> 403 (non-owner) before anything about the family is revealed.
    const family = await this.ensureFamilyOwnerUseCase.execute({ familyId, userId });

    if (family.status === FamilyStatus.ARCHIVED) {
      return;
    }

    const [finance, pendingInvites] = await Promise.all([
      this.getFamilyArchiveBlockersUseCase.execute({ familyId, today: todayInSaoPaulo() }),
      this.getFamilyPendingInvitesUseCase.execute({ familyId }),
    ]);
    const { counts, ...lists } = finance;

    if (Object.values(counts).every((count) => count === 0) && pendingInvites.length === 0) {
      return;
    }

    throw new ConflictException({
      blockers: { ...lists, pendingInvites },
      counts: { ...counts, pendingInvites: pendingInvites.length },
      message: 'Family has pending items',
    });
  }

  async create(userId: string, input: CreateFamilyInput): Promise<FamilyOutput> {
    // The family module cannot import the user module, so the owner email is resolved here.
    const user = await this.findUserByIdUseCase.execute({ id: userId });

    const family = await this.createFamilyUseCase.execute({
      name: input.name,
      ownerEmail: user.email,
      ownerId: userId,
    });

    // Spec 038 FR 11: the creator's All categories reach the new family. Idempotent, no cross-module transaction.
    await this.addFamilyToCategoryScopesUseCase.execute({ familyId: family.id, userId });

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
    // Spec 038 FR 13: the family leaves the scopes of every All category.
    await this.removeFamilyFromCategoryScopesUseCase.execute({ familyId });
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
    // Spec 042: archiving an ACTIVE family is refused while it has pending items (409 + blockers).
    if (input.status === FamilyStatus.ARCHIVED) {
      await this.assertNoPendingItems(userId, familyId);
    }

    const family = await this.updateFamilyUseCase.execute({
      familyId,
      name: input.name,
      status: input.status,
      userId,
    });

    return toApiOutput(family);
  }
}
