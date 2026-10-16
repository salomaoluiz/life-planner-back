import { mocks, setup } from './card-credit.controller.mocks';

const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';
const other = '7a1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a11';
const refund = {
  date: '2026-10-16',
  description: 'Refund',
  invoiceMonth: '2026-10',
  value: 5,
};

it('SHOULD be served at /finance/credit-cards under URI version 1', () => {
  expect(Reflect.getMetadata('path', setup.constructor)).toBe('finance/credit-cards');
  expect(Reflect.getMetadata('__version__', setup.constructor)).toBe('1');
});

it('SHOULD create a refund with the validated body AND the query today', async () => {
  await setup.createRefund(mocks.request, id, refund as never, { today: '2026-10-16' });

  expect(mocks.service.createRefund).toHaveBeenCalledWith(
    mocks.request.user.id,
    id,
    refund,
    '2026-10-16',
  );
  await expect(
    setup.createRefund(mocks.request, id, { ...refund, value: 0 } as never, {}),
  ).rejects.toThrow();
});

it('SHOULD update and delete a refund', async () => {
  await setup.updateRefund(mocks.request, id, other, { description: 'x' } as never, {});
  await setup.deleteRefund(mocks.request, id, other);

  expect(mocks.service.updateRefund).toHaveBeenCalledWith(
    mocks.request.user.id,
    id,
    other,
    { description: 'x' },
    undefined,
  );
  expect(mocks.service.deleteRefund).toHaveBeenCalledWith(mocks.request.user.id, id, other);
});

it('SHOULD create, update and delete an early payment AND reject a bad method shape', async () => {
  const body = { ...refund, accountId: other, method: 'ACCOUNT' };

  await setup.createEarlyPayment(mocks.request, id, body as never, {});
  await setup.updateEarlyPayment(mocks.request, id, other, { value: 7 } as never, {});
  await setup.deleteEarlyPayment(mocks.request, id, other);

  expect(mocks.service.createEarlyPayment).toHaveBeenCalledWith(
    mocks.request.user.id,
    id,
    body,
    undefined,
  );
  expect(mocks.service.updateEarlyPayment).toHaveBeenCalledTimes(1);
  expect(mocks.service.deleteEarlyPayment).toHaveBeenCalledWith(mocks.request.user.id, id, other);
  await expect(
    setup.createEarlyPayment(mocks.request, id, { ...body, accountId: undefined } as never, {}),
  ).rejects.toThrow();
});
