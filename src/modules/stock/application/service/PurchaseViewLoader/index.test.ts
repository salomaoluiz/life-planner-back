import {
  purchase,
  purchaseRepositoryMock,
  purchaseRow,
  shoppingList,
  shoppingListRepositoryMock,
  shoppingRow,
} from '@stock/application/mocks/stock.mocks';

import { loadPurchaseViews } from './index';

const lists = shoppingListRepositoryMock();
const purchases = purchaseRepositoryMock();

beforeEach(() => {
  jest.clearAllMocks();
  lists.findRowsByLists.mockResolvedValue([
    shoppingRow('l1', shoppingList('list-id'), { price: 100 }),
  ]);
  purchases.findByList.mockResolvedValue([purchase('p1'), purchase('p2')]);
  purchases.findRows.mockResolvedValue([purchaseRow('r1', { listRowId: 'l1', purchaseId: 'p2' })]);
});

it('SHOULD answer nothing without purchases AND read once for the whole list', async () => {
  expect(await loadPurchaseViews({ lists, purchases }, 'list-id', [])).toEqual([]);
  expect(lists.findRowsByLists).not.toHaveBeenCalled();

  const views = await loadPurchaseViews({ lists, purchases }, 'list-id', [
    purchase('p1'),
    purchase('p2'),
  ]);

  expect(views).toHaveLength(2);
  expect(lists.findRowsByLists).toHaveBeenCalledTimes(1);
  expect(purchases.findRows).toHaveBeenCalledTimes(1);
  // The list row checked in p2 is no longer "remaining" for anyone.
  expect(views[0].remaining.count).toBe(0);
  expect(purchases.findLastPrices).toHaveBeenCalledTimes(2);
});
