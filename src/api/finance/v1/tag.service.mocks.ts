import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { TagService } from '@api/finance/v1/tag.service';
import { CreateTagUseCase } from '@finance/application/use-case/CreateTagUseCase';
import { DeleteTagUseCase } from '@finance/application/use-case/DeleteTagUseCase';
import { GetTagsUseCase } from '@finance/application/use-case/GetTagsUseCase';
import { UpdateTagUseCase } from '@finance/application/use-case/UpdateTagUseCase';
import TagEntityFixture from '@finance/domain/entity/mocks/TagEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const familyId = faker.string.uuid();
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];
const singleMock = new TagEntityFixture().withOwnerId(userId).withUsageCount(3).build();
const allMock = new TagEntityFixture()
  .withAllScopes([accessibleOwners[1], accessibleOwners[0]], userId)
  .build();

const createTagUseCaseMock = { execute: jest.fn().mockResolvedValue(singleMock) };
const deleteTagUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const financeAccessServiceMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const getTagsUseCaseMock = { execute: jest.fn().mockResolvedValue([singleMock]) };
const updateTagUseCaseMock = { execute: jest.fn().mockResolvedValue(singleMock) };

// endregion Mocks

let setup: TagService;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      TagService,
      { provide: CreateTagUseCase, useValue: createTagUseCaseMock },
      { provide: DeleteTagUseCase, useValue: deleteTagUseCaseMock },
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetTagsUseCase, useValue: getTagsUseCaseMock },
      { provide: UpdateTagUseCase, useValue: updateTagUseCaseMock },
    ],
  }).compile();

  setup = module.get(TagService);
});

const mocks = {
  accessibleOwners,
  allTag: allMock,
  createTagUseCase: createTagUseCaseMock,
  deleteTagUseCase: deleteTagUseCaseMock,
  financeAccessService: financeAccessServiceMock,
  getTagsUseCase: getTagsUseCaseMock,
  singleTag: singleMock,
  updateTagUseCase: updateTagUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
