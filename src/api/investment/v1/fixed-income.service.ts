import { Injectable } from '@nestjs/common';

import {
  AdjustmentApiInput,
  ContributionApiInput,
  CreateFixedIncomeTitleApiInput,
  RateApiInput,
  RedemptionApiInput,
  RedemptionPreviewApiInput,
  SimulateApiInput,
  UpsertTermsApiInput,
} from '@api/investment/v1/dto/fixed-income.dto';
import { toAssetDetail, toOperation } from '@api/investment/v1/investment.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { CreateFixedIncomeContributionUseCase } from '@investment/application/use-case/CreateFixedIncomeContributionUseCase';
import { CreateFixedIncomeRateUseCase } from '@investment/application/use-case/CreateFixedIncomeRateUseCase';
import { CreateFixedIncomeRedemptionUseCase } from '@investment/application/use-case/CreateFixedIncomeRedemptionUseCase';
import { CreateFixedIncomeTitleUseCase } from '@investment/application/use-case/CreateFixedIncomeTitleUseCase';
import { DeleteFixedIncomeAdjustmentUseCase } from '@investment/application/use-case/DeleteFixedIncomeAdjustmentUseCase';
import { DeleteFixedIncomeRateUseCase } from '@investment/application/use-case/DeleteFixedIncomeRateUseCase';
import { PreviewFixedIncomeRedemptionUseCase } from '@investment/application/use-case/PreviewFixedIncomeRedemptionUseCase';
import { SimulateFixedIncomeUseCase } from '@investment/application/use-case/SimulateFixedIncomeUseCase';
import { UpdateFixedIncomeRateUseCase } from '@investment/application/use-case/UpdateFixedIncomeRateUseCase';
import { UpsertFixedIncomeAdjustmentUseCase } from '@investment/application/use-case/UpsertFixedIncomeAdjustmentUseCase';
import { UpsertFixedIncomeTermsUseCase } from '@investment/application/use-case/UpsertFixedIncomeTermsUseCase';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 105 section 7: the fixed income routes; every write answers with the refreshed detail.
@Injectable()
export class FixedIncomeService {
  constructor(
    private readonly createContributionUseCase: CreateFixedIncomeContributionUseCase,
    private readonly createRateUseCase: CreateFixedIncomeRateUseCase,
    private readonly createRedemptionUseCase: CreateFixedIncomeRedemptionUseCase,
    private readonly createTitleUseCase: CreateFixedIncomeTitleUseCase,
    private readonly deleteAdjustmentUseCase: DeleteFixedIncomeAdjustmentUseCase,
    private readonly deleteRateUseCase: DeleteFixedIncomeRateUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly previewRedemptionUseCase: PreviewFixedIncomeRedemptionUseCase,
    private readonly simulateUseCase: SimulateFixedIncomeUseCase,
    private readonly updateRateUseCase: UpdateFixedIncomeRateUseCase,
    private readonly upsertAdjustmentUseCase: UpsertFixedIncomeAdjustmentUseCase,
    private readonly upsertTermsUseCase: UpsertFixedIncomeTermsUseCase,
  ) {}

  async createContribution(userId: string, assetId: string, input: ContributionApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const result = await this.createContributionUseCase.execute({
      ...input,
      accessibleOwners,
      assetId,
    });

    return {
      detail: toAssetDetail(result.detail).item,
      item: toOperation(result.operation),
      liquidityWarning: result.liquidityWarning,
    };
  }

  async createRate(userId: string, assetId: string, input: RateApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return toAssetDetail(
      await this.createRateUseCase.execute({ accessibleOwners, assetId, rate: input }),
    );
  }

  async createRedemption(userId: string, assetId: string, input: RedemptionApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const result = await this.createRedemptionUseCase.execute({
      ...input,
      accessibleOwners,
      assetId,
    });

    return {
      detail: toAssetDetail(result.detail).item,
      item: toOperation(result.operation),
      liquidityWarning: result.liquidityWarning,
    };
  }

  async createTitle(userId: string, input: CreateFixedIncomeTitleApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return toAssetDetail(await this.createTitleUseCase.execute({ ...input, accessibleOwners }));
  }

  async deleteAdjustment(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    await this.deleteAdjustmentUseCase.execute({ accessibleOwners, id });
  }

  async deleteRate(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    await this.deleteRateUseCase.execute({ accessibleOwners, id });
  }

  async previewRedemption(userId: string, assetId: string, input: RedemptionPreviewApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return this.previewRedemptionUseCase.execute({ ...input, accessibleOwners, assetId });
  }

  async simulate(input: SimulateApiInput) {
    return this.simulateUseCase.execute(input);
  }

  async updateRate(userId: string, id: string, input: RateApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return toAssetDetail(
      await this.updateRateUseCase.execute({ accessibleOwners, id, rate: input }),
    );
  }

  async upsertAdjustment(userId: string, assetId: string, date: string, input: AdjustmentApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const result = await this.upsertAdjustmentUseCase.execute({
      accessibleOwners,
      assetId,
      date,
      grossAmount: input.grossAmount,
    });

    return {
      detail: toAssetDetail(result.detail).item,
      item: { ...result.item, computedGross: result.computedGross },
    };
  }

  async upsertTerms(userId: string, assetId: string, input: UpsertTermsApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const { rate, ...terms } = input;

    return toAssetDetail(
      await this.upsertTermsUseCase.execute({ accessibleOwners, assetId, rate, terms }),
    );
  }

  // Resolved on every request: the caller plus every family they own or joined.
  private async getAccessibleOwners(userId: string): Promise<OwnerAccess[]> {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);

    return [
      { owner: OwnerType.USER, ownerId: userId },
      ...families.map(({ archived, familyId }) => ({
        archived,
        owner: OwnerType.FAMILY,
        ownerId: familyId,
      })),
    ];
  }
}
