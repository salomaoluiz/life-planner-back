import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';
import {
  dismissIfNeeded,
  syncOwnerRows,
  syncRestockRows,
} from '@stock/data/datasource/RestockSync';

import { ShoppingListDatasource } from './index';

jest.mock('@stock/data/datasource/RestockSync');

const spies = {
  dismiss: jest.mocked(dismissIfNeeded),
  dismissalDeleteMany: jest.fn(),
  itemFindMany: jest.fn(),
  itemFindUniqueOrThrow: jest.fn(),
  itemUpdate: jest.fn(),
  listCreate: jest.fn(),
  listCreateMany: jest.fn(),
  listDeleteMany: jest.fn(),
  listFindFirst: jest.fn(),
  listFindFirstOrThrow: jest.fn(),
  listFindMany: jest.fn(),
  listFindUnique: jest.fn(),
  listFindUniqueOrThrow: jest.fn(),
  listUpdate: jest.fn(),
  listUpdateMany: jest.fn(),
  rowCreate: jest.fn(),
  rowDelete: jest.fn(),
  rowFindFirst: jest.fn(),
  rowFindMany: jest.fn(),
  rowFindUnique: jest.fn(),
  rowFindUniqueOrThrow: jest.fn(),
  rowUpdate: jest.fn(),
  sync: jest.mocked(syncRestockRows),
  syncOwner: jest.mocked(syncOwnerRows),
  transaction: jest.fn(),
};
const client = {
  $transaction: spies.transaction,
  stockItem: {
    findMany: spies.itemFindMany,
    findUniqueOrThrow: spies.itemFindUniqueOrThrow,
    update: spies.itemUpdate,
  },
  stockRestockDismissal: { deleteMany: spies.dismissalDeleteMany },
  stockShoppingList: {
    create: spies.listCreate,
    createMany: spies.listCreateMany,
    deleteMany: spies.listDeleteMany,
    findFirst: spies.listFindFirst,
    findFirstOrThrow: spies.listFindFirstOrThrow,
    findMany: spies.listFindMany,
    findUnique: spies.listFindUnique,
    findUniqueOrThrow: spies.listFindUniqueOrThrow,
    update: spies.listUpdate,
    updateMany: spies.listUpdateMany,
  },
  stockShoppingListRow: {
    create: spies.rowCreate,
    delete: spies.rowDelete,
    findFirst: spies.rowFindFirst,
    findMany: spies.rowFindMany,
    findUnique: spies.rowFindUnique,
    findUniqueOrThrow: spies.rowFindUniqueOrThrow,
    update: spies.rowUpdate,
  },
};
const key = { owner: 'USER' as const, owner_id: 'user' };
let setup: ShoppingListDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  spies.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(client),
  );
  spies.rowCreate.mockResolvedValue({ id: 'new' });
  spies.rowFindUniqueOrThrow.mockResolvedValue({ id: 'row' });
  spies.listCreate.mockImplementation(async ({ data }) => ({ id: 'new', ...data }));
  spies.listUpdate.mockResolvedValue({ id: 'l' });
  spies.rowFindMany.mockResolvedValue([]);
  spies.itemFindMany.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [ShoppingListDatasource, { provide: Database, useValue: { client } }],
  }).compile();

  setup = module.get(ShoppingListDatasource);
});

export { key, setup, spies };
