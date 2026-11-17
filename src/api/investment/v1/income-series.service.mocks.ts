import { Test } from '@nestjs/testing';

import { IncomeSeriesService } from '@api/investment/v1/income-series.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { CreateIncomeSeriesUseCase } from '@investment/application/use-case/CreateIncomeSeriesUseCase';
import { GetIncomeSeriesByIdUseCase } from '@investment/application/use-case/GetIncomeSeriesByIdUseCase';
import { GetIncomeSeriesProjectionsUseCase } from '@investment/application/use-case/GetIncomeSeriesProjectionsUseCase';
import { GetIncomeSeriesUseCase } from '@investment/application/use-case/GetIncomeSeriesUseCase';
import { MaterializeIncomeSeriesUseCase } from '@investment/application/use-case/MaterializeIncomeSeriesUseCase';
import { PreviewIncomeSeriesUseCase } from '@investment/application/use-case/PreviewIncomeSeriesUseCase';
import { UpdateIncomeSeriesUseCase } from '@investment/application/use-case/UpdateIncomeSeriesUseCase';
import { incomeSeriesFixture } from '@investment/domain/entity/mocks/income.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const userId = 'user-1';
const series = incomeSeriesFixture();
const view = { nextPaymentDate: '2026-12-15', series };
const owners = [
  { owner: OwnerType.USER, ownerId: userId },
  { archived: false, owner: OwnerType.FAMILY, ownerId: 'family-1' },
];
const useCases = {
  create: { execute: jest.fn() },
  family: { execute: jest.fn() },
  findById: { execute: jest.fn() },
  list: { execute: jest.fn() },
  materialize: { execute: jest.fn() },
  preview: { execute: jest.fn() },
  projections: { execute: jest.fn() },
  update: { execute: jest.fn() },
};

let setup: IncomeSeriesService;

beforeEach(async () => {
  jest.resetAllMocks();
  useCases.family.execute.mockResolvedValue([{ archived: false, familyId: 'family-1' }]);

  const module = await Test.createTestingModule({
    providers: [
      IncomeSeriesService,
      { provide: CreateIncomeSeriesUseCase, useValue: useCases.create },
      { provide: GetIncomeSeriesByIdUseCase, useValue: useCases.findById },
      { provide: GetIncomeSeriesProjectionsUseCase, useValue: useCases.projections },
      { provide: GetIncomeSeriesUseCase, useValue: useCases.list },
      { provide: GetUserFamilyAccessUseCase, useValue: useCases.family },
      { provide: MaterializeIncomeSeriesUseCase, useValue: useCases.materialize },
      { provide: PreviewIncomeSeriesUseCase, useValue: useCases.preview },
      { provide: UpdateIncomeSeriesUseCase, useValue: useCases.update },
    ],
  }).compile();

  setup = module.get(IncomeSeriesService);
});

const mocks = { owners, series, useCases, userId, view };

export { mocks, setup };
