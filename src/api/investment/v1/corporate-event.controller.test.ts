import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { CorporateEventController } from './corporate-event.controller';
import { mocks, setup } from './corporate-event.controller.mocks';

const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const accountId = '1c7b2f8d-4a5e-4c3b-9dae-2f3a4b5c6d7e';
const userId = mocks.request.user.id;

it('SHOULD be served at /investments under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, CorporateEventController)).toBe('investments');
  expect(Reflect.getMetadata(VERSION_METADATA, CorporateEventController)).toBe('1');
});

it('SHOULD sell the fraction of an event after validating the strict body', async () => {
  const body = { accountId, date: '2026-04-04', grossAmount: 520 };

  expect(await setup.createFractionSale(mocks.request, id, body as never)).toBe(mocks.result);
  expect(mocks.service.createFractionSale).toHaveBeenCalledWith(userId, id, body);

  await expect(
    setup.createFractionSale(mocks.request, id, { ...body, quantity: '1' } as never),
  ).rejects.toThrow(ValidationError);
  await expect(
    setup.createFractionSale(mocks.request, id, { ...body, grossAmount: -1 } as never),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD list the suggestions with the query validated', async () => {
  await setup.findSuggestions(mocks.request, { assetId: id, limit: '10' });

  expect(mocks.service.findSuggestions).toHaveBeenCalledWith(userId, { assetId: id, limit: 10 });
  await expect(setup.findSuggestions(mocks.request, { assetId: 'x' })).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD approve with an optional body', async () => {
  await setup.approveSuggestion(mocks.request, id, undefined as never);
  await setup.approveSuggestion(mocks.request, id, { bonusPercent: '5' });

  expect(mocks.service.approveSuggestion).toHaveBeenNthCalledWith(1, userId, id, {});
  expect(mocks.service.approveSuggestion).toHaveBeenNthCalledWith(2, userId, id, {
    bonusPercent: '5',
  });
  await expect(
    setup.approveSuggestion(mocks.request, id, { type: 'BUY' } as never),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD reject a suggestion', async () => {
  await setup.rejectSuggestion(mocks.request, id);

  expect(mocks.service.rejectSuggestion).toHaveBeenCalledWith(userId, id);
});
