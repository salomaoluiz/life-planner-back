import { Test } from '@nestjs/testing';

import { FinancialCreditCard } from '@db/client';
import { FinanceCreditCardMapper } from '@finance/data/datasource/mapper/FinanceCreditCardMapper';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';

import { FinanceCreditCardRepository } from './index';

// region Mocks

jest.mock('@finance/data/datasource/mapper/FinanceCreditCardMapper');

const entityMock = new CreditCardEntityFixture().build();
const persistenceMock = { id: entityMock.id } as FinancialCreditCard;

const datasourceMock = {
  create: jest.fn().mockResolvedValue(persistenceMock),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
  findById: jest.fn().mockResolvedValue(persistenceMock),
  findByOwners: jest.fn().mockResolvedValue([persistenceMock]),
  update: jest.fn().mockResolvedValue(persistenceMock),
};

// endregion Mocks

// region Spies

const mapperToDomainSpy = jest.mocked(FinanceCreditCardMapper.toDomain);

// endregion Spies

let setup: FinanceCreditCardRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  mapperToDomainSpy.mockReturnValue(entityMock);

  const module = await Test.createTestingModule({
    providers: [
      FinanceCreditCardRepository,
      { provide: 'IFinanceCreditCardDatasource', useValue: datasourceMock },
    ],
  }).compile();

  setup = module.get<FinanceCreditCardRepository>(FinanceCreditCardRepository);
});

const mocks = {
  datasource: datasourceMock,
  entity: entityMock,
  persistence: persistenceMock,
};
const spies = { mapper: { toDomain: mapperToDomainSpy } };

export { mocks, setup, spies };
