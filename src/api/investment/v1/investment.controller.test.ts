import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { InvestmentController } from './investment.controller';
import { mocks, setup } from './investment.controller.mocks';

const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const ownerId = '1c7b2f8d-4a5e-4c3b-9dae-2f3a4b5c6d7e';
const userId = mocks.request.user.id;

it('SHOULD be served at /investments under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, InvestmentController)).toBe('investments');
  expect(Reflect.getMetadata(VERSION_METADATA, InvestmentController)).toBe('1');
});

describe('assets', () => {
  it('SHOULD list with the validated query', async () => {
    await setup.findAssets(mocks.request, { ownerId, status: 'ARCHIVED' });

    expect(mocks.service.findAssets).toHaveBeenCalledWith(userId, { ownerId, status: 'ARCHIVED' });
    await expect(setup.findAssets(mocks.request, { status: 'NOPE' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('SHOULD create after validating the body (strict)', async () => {
    const body = {
      assetClass: 'BR_STOCK',
      name: 'Itausa',
      owner: 'USER',
      ownerId,
      ticker: 'ITSA4',
    };

    expect(await setup.createAsset(mocks.request, body as never)).toBe(mocks.result);
    expect(mocks.service.createAsset).toHaveBeenCalledWith(userId, body);
    await expect(setup.createAsset(mocks.request, { ...body, extra: 1 } as never)).rejects.toThrow(
      ValidationError,
    );
  });

  it('SHOULD read, update and delete by id', async () => {
    await setup.findAssetById(mocks.request, id);
    await setup.updateAsset(mocks.request, id, { status: 'ARCHIVED' } as never);
    await setup.deleteAsset(mocks.request, id);

    expect(mocks.service.findAssetById).toHaveBeenCalledWith(userId, id);
    expect(mocks.service.updateAsset).toHaveBeenCalledWith(userId, id, { status: 'ARCHIVED' });
    expect(mocks.service.deleteAsset).toHaveBeenCalledWith(userId, id);
  });
});

describe('operations', () => {
  const body = {
    date: '2026-06-10',
    fees: [{ amount: 490, kind: 'BROKERAGE' }],
    quantity: '500',
    type: 'BUY',
    unitPrice: '10.20',
  };

  it('SHOULD create under the asset with a validated body', async () => {
    await setup.createOperation(mocks.request, id, body as never);

    expect(mocks.service.createOperation).toHaveBeenCalledWith(userId, id, body);
  });

  it('SHOULD refuse a numeric quantity, 9 decimals AND unknown keys', async () => {
    for (const bad of [{ quantity: 500 }, { quantity: '1.123456789' }, { assetId: id }]) {
      await expect(
        setup.createOperation(mocks.request, id, { ...body, ...bad } as never),
      ).rejects.toThrow(ValidationError);
    }
  });

  it('SHOULD refuse changing the type on update', async () => {
    await expect(
      setup.updateOperation(mocks.request, id, { type: 'SELL' } as never),
    ).rejects.toThrow(ValidationError);
    await setup.updateOperation(mocks.request, id, { quantity: '5' } as never);
    expect(mocks.service.updateOperation).toHaveBeenCalledWith(userId, id, { quantity: '5' });
  });

  it('SHOULD delete by id', async () => {
    await setup.deleteOperation(mocks.request, id);

    expect(mocks.service.deleteOperation).toHaveBeenCalledWith(userId, id);
  });
});

describe('valuations', () => {
  it('SHOULD upsert by asset and date', async () => {
    await setup.upsertValuation(mocks.request, id, '2026-11-01', { unitPrice: '10.61' } as never);

    expect(mocks.service.upsertValuation).toHaveBeenCalledWith(userId, id, '2026-11-01', {
      unitPrice: '10.61',
    });
  });

  it('SHOULD refuse a malformed date AND a numeric price', async () => {
    await expect(
      setup.upsertValuation(mocks.request, id, '01/11/2026', { unitPrice: '1' } as never),
    ).rejects.toThrow(ValidationError);
    await expect(
      setup.upsertValuation(mocks.request, id, '2026-11-01', { unitPrice: 1 } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('SHOULD delete by id', async () => {
    await setup.deleteValuation(mocks.request, id);

    expect(mocks.service.deleteValuation).toHaveBeenCalledWith(userId, id);
  });
});
