import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { IncomeController } from './income.controller';
import { mocks, setup } from './income.controller.mocks';

const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const accountId = '1c7b2f8d-4a5e-4c3b-9dae-2f3a4b5c6d7e';
const categoryId = '2d8c3a9e-5b6f-4d4c-8ebf-3a4b5c6d7e8f';
const userId = mocks.request.user.id;
const body = {
  accountId,
  amountPerUnit: '0.28',
  assetId: id,
  categoryId,
  exDate: '2026-09-10',
  netAmount: 7140,
  paymentDate: '2026-10-30',
  quantity: '300',
  status: 'RECEIVED',
  type: 'JCP',
};

it('SHOULD be served at /investments under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, IncomeController)).toBe('investments');
  expect(Reflect.getMetadata(VERSION_METADATA, IncomeController)).toBe('1');
});

it('SHOULD create after validating the strict body', async () => {
  expect(await setup.createIncome(mocks.request, body as never)).toBe(mocks.result);
  expect(mocks.service.createIncome).toHaveBeenCalledWith(userId, body);

  await expect(setup.createIncome(mocks.request, { ...body, extra: 1 } as never)).rejects.toThrow(
    ValidationError,
  );
  await expect(
    setup.createIncome(mocks.request, { ...body, netAmount: 0 } as never),
  ).rejects.toThrow(ValidationError);
  await expect(
    setup.createIncome(mocks.request, { ...body, quantity: '1,5' } as never),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD edit with a partial body AND refuse the asset id', async () => {
  await setup.updateIncome(mocks.request, id, { status: 'PLANNED' } as never);

  expect(mocks.service.updateIncome).toHaveBeenCalledWith(userId, id, { status: 'PLANNED' });
  await expect(setup.updateIncome(mocks.request, id, { assetId: id } as never)).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD receive with an optional body', async () => {
  await setup.receiveIncome(mocks.request, id, undefined as never);
  await setup.receiveIncome(mocks.request, id, { netAmount: 7215, receivedOn: '2026-11-04' });

  expect(mocks.service.receiveIncome).toHaveBeenNthCalledWith(1, userId, id, {});
  expect(mocks.service.receiveIncome).toHaveBeenNthCalledWith(2, userId, id, {
    netAmount: 7215,
    receivedOn: '2026-11-04',
  });
});

it('SHOULD read, delete AND list with the validated query', async () => {
  await setup.findIncomeById(mocks.request, id);
  await setup.deleteIncome(mocks.request, id);
  await setup.findIncomes(mocks.request, { assetId: id, limit: '20', status: 'PLANNED' });

  expect(mocks.service.findIncomeById).toHaveBeenCalledWith(userId, id);
  expect(mocks.service.deleteIncome).toHaveBeenCalledWith(userId, id);
  expect(mocks.service.findIncomes).toHaveBeenCalledWith(userId, {
    assetId: id,
    limit: 20,
    status: 'PLANNED',
  });
  await expect(setup.findIncomes(mocks.request, { limit: '1000' })).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD read the defaults with type AND ex-date', async () => {
  await setup.findDefaults(mocks.request, id, { exDate: '2026-09-10', type: 'JCP' });

  expect(mocks.service.findDefaults).toHaveBeenCalledWith(userId, id, {
    exDate: '2026-09-10',
    type: 'JCP',
  });
  await expect(setup.findDefaults(mocks.request, id, { type: 'NOPE' })).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD list, approve (with or without edits) AND reject suggestions', async () => {
  await setup.findSuggestions(mocks.request, { assetId: id });
  await setup.approveSuggestion(mocks.request, id, undefined as never);
  await setup.approveSuggestion(mocks.request, id, { netAmount: 14000 } as never);
  await setup.rejectSuggestion(mocks.request, id);

  expect(mocks.service.findSuggestions).toHaveBeenCalledWith(userId, { assetId: id });
  expect(mocks.service.approveSuggestion).toHaveBeenNthCalledWith(1, userId, id, {});
  expect(mocks.service.approveSuggestion).toHaveBeenNthCalledWith(2, userId, id, {
    netAmount: 14000,
  });
  expect(mocks.service.rejectSuggestion).toHaveBeenCalledWith(userId, id);
});
