import { Test } from '@nestjs/testing';

import { FixedIncomeService } from '@api/investment/v1/fixed-income.service';
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
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const userId = 'user-1';
const familyId = 'family-1';

const useCases = {
  createContribution: { execute: jest.fn() },
  createRate: { execute: jest.fn() },
  createRedemption: { execute: jest.fn() },
  createTitle: { execute: jest.fn() },
  deleteAdjustment: { execute: jest.fn() },
  deleteRate: { execute: jest.fn() },
  getUserFamilyAccess: { execute: jest.fn() },
  previewRedemption: { execute: jest.fn() },
  simulate: { execute: jest.fn() },
  updateRate: { execute: jest.fn() },
  upsertAdjustment: { execute: jest.fn() },
  upsertTerms: { execute: jest.fn() },
};

export let setup: FixedIncomeService;

beforeEach(async () => {
  jest.resetAllMocks();
  useCases.getUserFamilyAccess.execute.mockResolvedValue([{ archived: false, familyId }]);

  const module = await Test.createTestingModule({
    providers: [
      FixedIncomeService,
      { provide: CreateFixedIncomeContributionUseCase, useValue: useCases.createContribution },
      { provide: CreateFixedIncomeRateUseCase, useValue: useCases.createRate },
      { provide: CreateFixedIncomeRedemptionUseCase, useValue: useCases.createRedemption },
      { provide: CreateFixedIncomeTitleUseCase, useValue: useCases.createTitle },
      { provide: DeleteFixedIncomeAdjustmentUseCase, useValue: useCases.deleteAdjustment },
      { provide: DeleteFixedIncomeRateUseCase, useValue: useCases.deleteRate },
      { provide: GetUserFamilyAccessUseCase, useValue: useCases.getUserFamilyAccess },
      { provide: PreviewFixedIncomeRedemptionUseCase, useValue: useCases.previewRedemption },
      { provide: SimulateFixedIncomeUseCase, useValue: useCases.simulate },
      { provide: UpdateFixedIncomeRateUseCase, useValue: useCases.updateRate },
      { provide: UpsertFixedIncomeAdjustmentUseCase, useValue: useCases.upsertAdjustment },
      { provide: UpsertFixedIncomeTermsUseCase, useValue: useCases.upsertTerms },
    ],
  }).compile();

  setup = module.get(FixedIncomeService);
});

export const mocks = {
  accessibleOwners: [
    { owner: OwnerType.USER, ownerId: userId },
    { archived: false, owner: OwnerType.FAMILY, ownerId: familyId },
  ],
  useCases,
  userId,
};
