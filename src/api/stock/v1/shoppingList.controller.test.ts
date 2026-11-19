import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { listLanguageOf, ShoppingListController } from './shoppingList.controller';
import { mocks, setup } from './shoppingList.controller.mocks';

const { id, ownerId, request, service, userId } = mocks;
let controller: Awaited<ReturnType<typeof setup>>['controller'];
let summary: Awaited<ReturnType<typeof setup>>['summary'];

beforeEach(async () => {
  ({ controller, summary } = await setup());
});

it('SHOULD be served at /stock/shopping-lists under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, ShoppingListController)).toBe('stock/shopping-lists');
  expect(Reflect.getMetadata(VERSION_METADATA, ShoppingListController)).toBe('1');
});

it('SHOULD read the language of the request (none = undefined, so the default list is pt-BR)', () => {
  expect(listLanguageOf()).toBeUndefined();
  expect(listLanguageOf('pt-BR,pt;q=0.9')).toBe('pt-BR');
  expect(listLanguageOf('en-US')).toBe('en-US');
});

it('SHOULD list with the owner filter and archived flag', async () => {
  expect(await controller.findAll(request, { includeArchived: 'true', ownerId }, 'en-US')).toBe(
    mocks.result,
  );
  expect(service.findAll).toHaveBeenCalledWith(userId, { includeArchived: true, ownerId }, 'en-US');
});

it('SHOULD create a list AND reject unknown fields', async () => {
  await controller.create(request, { name: 'Pharmacy', owner: 'USER', ownerId } as never, 'pt-BR');
  expect(service.create).toHaveBeenCalledWith(
    userId,
    { name: 'Pharmacy', owner: 'USER', ownerId },
    'pt-BR',
  );

  expect(async () =>
    controller.create(request, { extra: 1, name: 'x', owner: 'USER', ownerId } as never),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD refuse changing the owner of a list (400) AND require a field', async () => {
  await expect(
    controller.update(request, id, { owner: 'FAMILY', ownerId } as never),
  ).rejects.toThrow(ValidationError);
  await expect(controller.update(request, id, {} as never)).rejects.toThrow(ValidationError);

  await controller.update(request, id, { isDefault: true });
  expect(service.update).toHaveBeenCalledWith(userId, id, { isDefault: true });
});

it('SHOULD read the detail and the restock summary', async () => {
  await controller.findById(request, id);
  await summary.restockSummary(request);

  expect(service.findById).toHaveBeenCalledWith(userId, id);
  expect(service.restockSummary).toHaveBeenCalledWith(userId);
});

it('SHOULD answer 200 on a merge and keep the default 201 otherwise', async () => {
  const response = { status: jest.fn() };

  service.addRow.mockResolvedValueOnce({ merged: true, row: {} });
  await controller.addRow(request, id, { itemId: ownerId, quantity: 2 }, response);
  expect(response.status).toHaveBeenCalledWith(200);

  response.status.mockClear();
  service.addRow.mockResolvedValueOnce({ merged: false, row: {} });
  await controller.addRow(
    request,
    id,
    { description: 'Candle', quantity: 1, unit: StockUnits.UNIT },
    response,
  );
  expect(response.status).not.toHaveBeenCalled();
});

it('SHOULD pass the restore origin through AND reject unknown keys on a row', async () => {
  const response = { status: jest.fn() };

  await expect(
    controller.addRow(request, id, { itemId: ownerId, origin: 'AUTO', quantity: 1 }, response),
  ).resolves.toBeDefined();
  // Shape rules live in the use case; the API only validates types and strictness.
  await expect(
    controller.addRow(request, id, { bogus: true, quantity: 1 } as never, response),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD update and delete a row', async () => {
  await controller.updateRow(request, id, { quantity: 3 });
  await expect(controller.updateRow(request, id, {} as never)).rejects.toThrow(ValidationError);
  await controller.deleteRow(request, id);

  expect(service.updateRow).toHaveBeenCalledWith(userId, id, { quantity: 3 });
  expect(service.deleteRow).toHaveBeenCalledWith(userId, id);
});
