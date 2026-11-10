import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { InvestmentService } from '@api/investment/v1/investment.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { AssetDetailView, AssetView } from '@investment/application/service/AssetView';
import { CreateAssetUseCase } from '@investment/application/use-case/CreateAssetUseCase';
import { CreateOperationUseCase } from '@investment/application/use-case/CreateOperationUseCase';
import { DeleteAssetUseCase } from '@investment/application/use-case/DeleteAssetUseCase';
import { DeleteOperationUseCase } from '@investment/application/use-case/DeleteOperationUseCase';
import { DeleteValuationUseCase } from '@investment/application/use-case/DeleteValuationUseCase';
import { GetAssetByIdUseCase } from '@investment/application/use-case/GetAssetByIdUseCase';
import { GetAssetsUseCase } from '@investment/application/use-case/GetAssetsUseCase';
import { UpdateAssetUseCase } from '@investment/application/use-case/UpdateAssetUseCase';
import { UpdateOperationUseCase } from '@investment/application/use-case/UpdateOperationUseCase';
import { UpsertValuationUseCase } from '@investment/application/use-case/UpsertValuationUseCase';
import {
  assetFixture,
  operationFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

// region Mocks

const userId = faker.string.uuid();
const familyId = faker.string.uuid();
const asset = assetFixture({ ownerId: userId });
const operation = operationFixture({
  accountId: faker.string.uuid(),
  assetId: asset.id,
  fees: [{ amount: 490, description: null, id: faker.string.uuid(), kind: 'BROKERAGE' as never }],
  generateTransaction: true,
  quantity: Decimal8.parse('18.3572'),
  transactionId: faker.string.uuid(),
  unitPrice: Decimal8.parse('10.5'),
});
const position = {
  averagePrice: '9.82200000',
  cost: 1178640,
  currentUnitPrice: Decimal8.parse('10.53'),
  currentValue: 1263600,
  currentValueDate: '2026-11-01',
  openResult: 84960,
  openResultPercent: 0.0721,
  quantity: Decimal8.parse('1200'),
  realizedResult: 31790,
};
const view: AssetView = { asset, operationCount: 1, position };
const valuation = valuationFixture({ assetId: asset.id });
const detailView: AssetDetailView = {
  ...view,
  operations: [{ costRemoved: 294660, operation, realizedResult: 31790 }],
  valuations: [valuation],
};
const positionApi = {
  averagePrice: '9.82200000',
  cost: 1178640,
  currentUnitPrice: '10.53',
  currentValue: 1263600,
  currentValueDate: '2026-11-01',
  openResult: 84960,
  openResultPercent: 0.0721,
  quantity: '1200',
  realizedResult: 31790,
};

const useCaseMocks = {
  createAsset: { execute: jest.fn() },
  createOperation: { execute: jest.fn() },
  deleteAsset: { execute: jest.fn() },
  deleteOperation: { execute: jest.fn() },
  deleteValuation: { execute: jest.fn() },
  getAssetById: { execute: jest.fn() },
  getAssets: { execute: jest.fn() },
  getUserFamilyAccess: { execute: jest.fn() },
  updateAsset: { execute: jest.fn() },
  updateOperation: { execute: jest.fn() },
  upsertValuation: { execute: jest.fn() },
};

// endregion Mocks

let setup: InvestmentService;

beforeEach(async () => {
  jest.resetAllMocks();
  useCaseMocks.getUserFamilyAccess.execute.mockResolvedValue([{ archived: true, familyId }]);

  const module = await Test.createTestingModule({
    providers: [
      InvestmentService,
      { provide: CreateAssetUseCase, useValue: useCaseMocks.createAsset },
      { provide: CreateOperationUseCase, useValue: useCaseMocks.createOperation },
      { provide: DeleteAssetUseCase, useValue: useCaseMocks.deleteAsset },
      { provide: DeleteOperationUseCase, useValue: useCaseMocks.deleteOperation },
      { provide: DeleteValuationUseCase, useValue: useCaseMocks.deleteValuation },
      { provide: GetAssetByIdUseCase, useValue: useCaseMocks.getAssetById },
      { provide: GetAssetsUseCase, useValue: useCaseMocks.getAssets },
      { provide: GetUserFamilyAccessUseCase, useValue: useCaseMocks.getUserFamilyAccess },
      { provide: UpdateAssetUseCase, useValue: useCaseMocks.updateAsset },
      { provide: UpdateOperationUseCase, useValue: useCaseMocks.updateOperation },
      { provide: UpsertValuationUseCase, useValue: useCaseMocks.upsertValuation },
    ],
  }).compile();

  setup = module.get(InvestmentService);
});

const mocks = {
  accessibleOwners: [
    { owner: OwnerType.USER, ownerId: userId },
    { archived: true, owner: OwnerType.FAMILY, ownerId: familyId },
  ],
  asset,
  detailView,
  operation,
  positionApi,
  useCases: useCaseMocks,
  userId,
  valuation,
  view,
};
const spies = {};

export { mocks, setup, spies };
