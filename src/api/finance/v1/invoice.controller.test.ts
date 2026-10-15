import { HTTP_CODE_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { InvoiceController } from './invoice.controller';
import { mocks, setup } from './invoice.controller.mocks';

const cardId = '7c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const accountId = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';

it('SHOULD share the credit-cards path AND declare the static list route first', () => {
  expect(Reflect.getMetadata(PATH_METADATA, InvoiceController)).toBe('finance/credit-cards');
});

describe('findAllForList', () => {
  it('SHOULD require month AND forward owner ids and today', async () => {
    await setup.findAllForList(mocks.request, {
      month: '2026-11',
      ownerId: accountId,
      today: '2026-10-15',
    });

    expect(mocks.invoiceService.findForList).toHaveBeenCalledWith(
      mocks.userId,
      '2026-11',
      [accountId],
      '2026-10-15',
    );
    await expect(setup.findAllForList(mocks.request, {})).rejects.toThrow(ValidationError);
    await expect(setup.findAllForList(mocks.request, { month: '2026-13' })).rejects.toThrow(
      ValidationError,
    );
  });
});

describe('findOne', () => {
  it('SHOULD validate the month param', async () => {
    await setup.findOne(mocks.request, cardId, '2026-10', {});

    expect(mocks.invoiceService.findOne).toHaveBeenCalledWith(
      mocks.userId,
      cardId,
      '2026-10',
      undefined,
    );
    await expect(setup.findOne(mocks.request, cardId, 'oct', {})).rejects.toThrow(ValidationError);
  });
});

describe('pay', () => {
  it('SHOULD accept ACCOUNT with accountId AND EXTERNAL without it', async () => {
    await setup.pay(
      mocks.request,
      cardId,
      '2026-10',
      { accountId, method: 'ACCOUNT' } as never,
      {},
    );
    await setup.pay(mocks.request, cardId, '2026-10', { method: 'EXTERNAL' } as never, {});

    expect(mocks.invoiceService.pay).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['ACCOUNT without accountId', { method: 'ACCOUNT' }],
    ['EXTERNAL with accountId', { accountId, method: 'EXTERNAL' }],
    ['an unknown key', { extra: 1, method: 'EXTERNAL' }],
  ])('SHOULD throw ValidationError (400) for %s', async (_label, body) => {
    await expect(setup.pay(mocks.request, cardId, '2026-10', body as never, {})).rejects.toThrow(
      ValidationError,
    );
    expect(mocks.invoiceService.pay).not.toHaveBeenCalled();
  });
});

describe('deletePayment', () => {
  it('SHOULD undo AND answer 204', async () => {
    await setup.deletePayment(mocks.request, cardId, '2026-10');

    expect(mocks.invoiceService.undo).toHaveBeenCalledWith(mocks.userId, cardId, '2026-10');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, InvoiceController.prototype.deletePayment)).toBe(
      204,
    );
  });
});
