import { Test } from '@nestjs/testing';

import { FinanceInstallmentPlanMapper } from '@finance/data/datasource/mapper/FinanceInstallmentPlanMapper';
import InstallmentPlanEntity from '@finance/domain/entity/InstallmentPlanEntity';

import { FinanceInstallmentPlanRepository } from './index';

// region Mocks

jest.mock('@finance/data/datasource/mapper/FinanceInstallmentPlanMapper');

const planDatasourceMock = {
  create: jest.fn().mockResolvedValue('plan-1'),
  delete: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue({ id: 'plan-1' }),
  findManyByCategoryIds: jest
    .fn()
    .mockResolvedValue([{ credit_card: { closing_day: 9 }, id: 'plan-1' }]),
  recreate: jest.fn().mockResolvedValue(undefined),
  updateFromNumber: jest.fn().mockResolvedValue(undefined),
  updateText: jest.fn().mockResolvedValue(undefined),
};

// endregion Mocks

const mapperSpy = jest.mocked(FinanceInstallmentPlanMapper.toDomain);

let setup: FinanceInstallmentPlanRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  mapperSpy.mockReturnValue({ id: 'plan-1' } as InstallmentPlanEntity);

  const module = await Test.createTestingModule({
    providers: [
      FinanceInstallmentPlanRepository,
      { provide: 'IFinanceInstallmentPlanDatasource', useValue: planDatasourceMock },
    ],
  }).compile();

  setup = module.get(FinanceInstallmentPlanRepository);
});

const mocks = { planDatasource: planDatasourceMock };
const spies = { mapper: mapperSpy };

export { mocks, setup, spies };
