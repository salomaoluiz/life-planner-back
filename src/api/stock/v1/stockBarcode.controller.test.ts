import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { StockBarcodeController, StockItemSuggestionController } from './stockBarcode.controller';

const findByBarcode = jest.fn().mockResolvedValue({ ok: true });
const suggest = jest.fn().mockResolvedValue({ ok: true });
const getUsage = jest.fn().mockResolvedValue({ ok: true });
const controller = new StockBarcodeController({ findByBarcode } as never);
const suggestions = new StockItemSuggestionController({ getUsage, suggest } as never);
const request = { user: { id: 'user-id' } } as never;

it('SHOULD be served at /stock/barcodes under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, StockBarcodeController)).toBe('stock/barcodes');
  expect(Reflect.getMetadata(VERSION_METADATA, StockBarcodeController)).toBe('1');
});

it('SHOULD pass the code and the day to the service', async () => {
  await controller.lookup(request, { code: '123' }, { today: '2026-11-10' });

  expect(findByBarcode).toHaveBeenCalledWith('user-id', '123', '2026-11-10');
});

it('SHOULD reject a malformed day', async () => {
  await expect(controller.lookup(request, { code: '123' }, { today: 'x' })).rejects.toThrow(
    ValidationError,
  );
});

describe('item suggestions', () => {
  const owner = { owner: 'USER' as never, ownerId: 'user-id' };

  it('SHOULD be served at /stock/item-suggestions', () => {
    expect(Reflect.getMetadata(PATH_METADATA, StockItemSuggestionController)).toBe(
      'stock/item-suggestions',
    );
  });

  it('SHOULD pass the barcode body to the service', async () => {
    await suggestions.suggest(request, { ...owner, barcode: '123' } as never);

    expect(suggest).toHaveBeenCalledWith('user-id', { ...owner, barcode: '123' });
  });

  it('SHOULD refuse a body with both or none of barcode and name', async () => {
    await expect(
      suggestions.suggest(request, { ...owner, barcode: '123', name: 'abc' } as never),
    ).rejects.toThrow(ValidationError);
    await expect(suggestions.suggest(request, owner as never)).rejects.toThrow(ValidationError);
  });

  it('SHOULD return the usage', async () => {
    await suggestions.usage(request);

    expect(getUsage).toHaveBeenCalledWith('user-id');
  });
});
