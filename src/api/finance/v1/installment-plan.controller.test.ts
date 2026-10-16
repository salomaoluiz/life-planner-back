import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { InstallmentPlanController } from './installment-plan.controller';
import { mocks, setup } from './installment-plan.controller.mocks';

const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';
const body = {
  categoryId: '1d0f8a3b-5c6e-4f70-8a91-b2c3d4e5f607',
  creditCardId: id,
  date: '2026-10-20',
  description: 'Notebook',
  installments: 10,
  owner: 'USER',
  ownerId: '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d',
  value: 512000,
};

it('SHOULD be served at /finance/installment-plans under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, InstallmentPlanController)).toBe(
    'finance/installment-plans',
  );
  expect(Reflect.getMetadata(VERSION_METADATA, InstallmentPlanController)).toBe('1');
});

describe('create', () => {
  it('SHOULD validate the body AND call the service with the JWT user', async () => {
    const result = await setup.create(mocks.request, body as never, { today: '2026-10-16' });

    expect(mocks.service.create).toHaveBeenCalledWith(mocks.request.user.id, body, '2026-10-16');
    expect(result).toEqual(mocks.output);
  });

  it.each([
    ['1 installment', { installments: 1 }],
    ['49 installments', { installments: 49 }],
    ['a fractional count', { installments: 2.5 }],
    ['a total below the count', { installments: 10, value: 5 }],
    ['a bad date', { date: '2026-02-30' }],
  ])('SHOULD throw ValidationError (400) WHEN the body has %s', async (_label, patch) => {
    await expect(setup.create(mocks.request, { ...body, ...patch } as never, {})).rejects.toThrow(
      ValidationError,
    );
    expect(mocks.service.create).not.toHaveBeenCalled();
  });
});

describe('findOne / update / delete', () => {
  it('SHOULD read by id with the query today', async () => {
    await setup.findOne(mocks.request, id, { today: '2026-10-16' });

    expect(mocks.service.findOne).toHaveBeenCalledWith(mocks.request.user.id, id, '2026-10-16');
  });

  it('SHOULD update with a validated partial body AND reject unknown or empty bodies', async () => {
    await setup.update(mocks.request, id, { description: 'Laptop' } as never, {});

    expect(mocks.service.update).toHaveBeenCalledWith(
      mocks.request.user.id,
      id,
      { description: 'Laptop' },
      undefined,
    );
    await expect(setup.update(mocks.request, id, {} as never, {})).rejects.toThrow(ValidationError);
    await expect(setup.update(mocks.request, id, { owner: 'FAMILY' } as never, {})).rejects.toThrow(
      ValidationError,
    );
  });

  it('SHOULD delete by id', async () => {
    await setup.delete(mocks.request, id);

    expect(mocks.service.delete).toHaveBeenCalledWith(mocks.request.user.id, id);
  });
});

describe('prepayment routes', () => {
  const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';

  it('SHOULD prepay with the validated body AND the query today', async () => {
    await setup.prepay(
      mocks.request,
      id,
      { date: '2026-10-16', targetInvoiceMonth: '2026-10' } as never,
      { today: '2026-10-16' },
    );

    expect(mocks.service.prepay).toHaveBeenCalledWith(
      mocks.request.user.id,
      id,
      { date: '2026-10-16', targetInvoiceMonth: '2026-10' },
      '2026-10-16',
    );
  });

  it('SHOULD reject a prepay body without the target invoice', async () => {
    await expect(
      setup.prepay(mocks.request, id, { date: '2026-10-16' } as never, {}),
    ).rejects.toThrow();
  });

  it('SHOULD preview the target invoice', async () => {
    await setup.findPrepaymentPreview(mocks.request, id, { targetInvoiceMonth: '2026-10' });

    expect(mocks.service.prepaymentPreview).toHaveBeenCalledWith(
      mocks.request.user.id,
      id,
      '2026-10',
      undefined,
    );
  });

  it('SHOULD undo the prepayment', async () => {
    await setup.deletePrepayment(mocks.request, id);

    expect(mocks.service.undoPrepayment).toHaveBeenCalledWith(mocks.request.user.id, id);
  });
});
