import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { archivedOwners } from '@stock/application/mocks/stock.mocks';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { base, mocks, setup } from './index.mocks';

const CODE = '7891000100103';
const product = { brands: 'Marca, Outra', name: 'Leite integral', quantity: '1 L' };

describe('code found in Open Food Facts', () => {
  beforeEach(() => {
    mocks.off.getProduct.mockResolvedValue(product);
    mocks.llm.complete.mockResolvedValue({
      categoryPath: 'Laticínios',
      locationName: 'Geladeira',
      openedShelfLifeDays: 5,
    });
  });

  it('SHOULD fill from Open Food Facts AND the light call, counting only the light counter', async () => {
    const result = await setup.execute({ ...base, barcode: CODE });

    expect(result.fields).toEqual({
      brand: 'Marca',
      categoryId: 'c1',
      description: 'Leite integral',
      locationId: 'l1',
      openedShelfLifeDays: 5,
      packageQuantity: 1,
      unit: StockUnits.LITER,
    });
    expect(result.sources).toMatchObject({
      brand: 'OPEN_FOOD_FACTS',
      categoryId: 'AI',
      description: 'OPEN_FOOD_FACTS',
    });
    expect(result.notice).toBeNull();
    expect(result.usage).toBe(mocks.usage);
    expect(mocks.consume.execute).toHaveBeenCalledTimes(1);
    expect(mocks.consume.execute).toHaveBeenCalledWith(expect.objectContaining({ kind: 'LIGHT' }));
    expect(mocks.llm.complete).toHaveBeenCalledWith(expect.objectContaining({ kind: 'LIGHT' }));
  });

  it('SHOULD send only the owner’s ACTIVE categories and locations to the AI', async () => {
    await setup.execute({ ...base, barcode: CODE });

    const { user } = mocks.llm.complete.mock.calls[0][0];

    expect(user).toContain('Laticínios');
    expect(user).not.toContain('Doces');
  });

  it('SHOULD drop a category path or location that is not the owner’s', async () => {
    mocks.llm.complete.mockResolvedValue({ categoryPath: 'Bebidas', locationName: 'Garagem' });

    const result = await setup.execute({ ...base, barcode: CODE });

    expect(result.fields.categoryId).toBeUndefined();
    expect(result.fields.locationId).toBeUndefined();
    expect(result.fields.description).toBe('Leite integral');
  });

  it('SHOULD keep the Open Food Facts fields WITH LIMIT_REACHED WHEN the light limit is over', async () => {
    mocks.consume.execute.mockResolvedValue(false);

    const result = await setup.execute({ ...base, barcode: CODE });

    expect(result.notice).toBe('LIMIT_REACHED');
    expect(mocks.llm.complete).not.toHaveBeenCalled();
    expect(result.fields.description).toBe('Leite integral');
  });

  it('SHOULD answer AI_UNAVAILABLE WHEN the provider fails', async () => {
    mocks.llm.complete.mockResolvedValue(null);

    const result = await setup.execute({ ...base, barcode: CODE });

    expect(result.notice).toBe('AI_UNAVAILABLE');
    expect(result.fields.description).toBe('Leite integral');
  });

  it('SHOULD return Open Food Facts only, WITHOUT counting, WHEN the AI is not configured', async () => {
    mocks.llm.isEnabled.mockReturnValue(false);

    const result = await setup.execute({ ...base, barcode: CODE });

    expect(result.notice).toBeNull();
    expect(mocks.consume.execute).not.toHaveBeenCalled();
    expect(result.fields.description).toBe('Leite integral');
  });
});

describe('code unknown to Open Food Facts', () => {
  it('SHOULD use the full call AND count the search counter', async () => {
    mocks.llm.complete.mockResolvedValue({
      brand: 'Marca',
      confidence: 'HIGH',
      description: 'Café torrado',
      packageQuantity: 0.5,
      unit: StockUnits.KILOGRAM,
    });

    const result = await setup.execute({ ...base, barcode: CODE });

    expect(mocks.consume.execute).toHaveBeenCalledWith(expect.objectContaining({ kind: 'SEARCH' }));
    expect(result.fields).toMatchObject({ description: 'Café torrado', unit: StockUnits.KILOGRAM });
    expect(result.sources.description).toBe('AI');
  });

  it('SHOULD not call the provider AND say LIMIT_REACHED WHEN the search limit is over', async () => {
    mocks.consume.execute.mockResolvedValue(false);

    const result = await setup.execute({ ...base, barcode: CODE });

    expect(result.notice).toBe('LIMIT_REACHED');
    expect(result.fields).toEqual({});
    expect(mocks.llm.complete).not.toHaveBeenCalled();
  });

  it('SHOULD drop the product fields WITH AI_NOT_SURE WHEN the confidence is LOW', async () => {
    mocks.llm.complete.mockResolvedValue({
      categoryPath: 'Laticínios',
      confidence: 'LOW',
      description: 'Maybe milk',
    });

    const result = await setup.execute({ ...base, barcode: CODE });

    expect(result.notice).toBe('AI_NOT_SURE');
    expect(result.fields).toEqual({ categoryId: 'c1' });
  });

  it('SHOULD answer NOT_FOUND WHEN the AI is not configured and nothing is known', async () => {
    mocks.llm.isEnabled.mockReturnValue(false);

    const result = await setup.execute({ ...base, barcode: CODE });

    expect(result).toMatchObject({ fields: {}, notice: 'NOT_FOUND' });
  });

  it('SHOULD treat an Open Food Facts failure as not found', async () => {
    mocks.off.getProduct.mockResolvedValue(undefined);
    mocks.llm.complete.mockResolvedValue({ confidence: 'HIGH', description: 'Café' });

    const result = await setup.execute({ ...base, barcode: CODE });

    expect(result.fields.description).toBe('Café');
  });
});

describe('name', () => {
  it('SHOULD use the full call WITHOUT asking Open Food Facts', async () => {
    mocks.llm.complete.mockResolvedValue({ confidence: 'HIGH', description: 'Achocolatado diet' });

    const result = await setup.execute({ ...base, name: 'achocolatado diet' });

    expect(mocks.off.getProduct).not.toHaveBeenCalled();
    expect(mocks.consume.execute).toHaveBeenCalledWith(expect.objectContaining({ kind: 'SEARCH' }));
    expect(result.fields.description).toBe('Achocolatado diet');
  });
});

describe('cache', () => {
  it('SHOULD answer a repeated request WITHOUT counting again AND still return the usage', async () => {
    mocks.off.getProduct.mockResolvedValue(product);
    mocks.llm.complete.mockResolvedValue({ categoryPath: 'Laticínios' });

    await setup.execute({ ...base, barcode: CODE });
    const second = await setup.execute({ ...base, barcode: CODE });

    expect(mocks.consume.execute).toHaveBeenCalledTimes(1);
    expect(second.fields.categoryId).toBe('c1');
    expect(mocks.getUsage.execute).toHaveBeenCalledTimes(2);
  });

  it('SHOULD not share answers between users', async () => {
    mocks.off.getProduct.mockResolvedValue(product);

    await setup.execute({ ...base, barcode: CODE });
    await setup.execute({ ...base, barcode: CODE, userId: 'another-user' });

    expect(mocks.consume.execute).toHaveBeenCalledTimes(2);
  });

  it('SHOULD not remember a provider failure', async () => {
    mocks.off.getProduct.mockResolvedValue(product);

    await setup.execute({ ...base, barcode: CODE });
    await setup.execute({ ...base, barcode: CODE });

    expect(mocks.consume.execute).toHaveBeenCalledTimes(2);
  });
});

describe('validation', () => {
  it('SHOULD answer 404 for an owner the user cannot read', async () => {
    await expect(
      setup.execute({ ...base, barcode: CODE, ownerId: 'someone-else' }),
    ).rejects.toThrow(NotFoundException);
    expect(mocks.off.getProduct).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 for an archived family BEFORE any external call', async () => {
    await expect(
      setup.execute({
        ...base,
        accessibleOwners: archivedOwners,
        barcode: CODE,
        owner: 'FAMILY' as never,
        ownerId: 'family-id',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mocks.off.getProduct).not.toHaveBeenCalled();
  });

  it('SHOULD answer 400 for a wrong check digit', async () => {
    await expect(setup.execute({ ...base, barcode: '7891000100104' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('SHOULD require exactly one of barcode and name', async () => {
    await expect(setup.execute({ ...base })).rejects.toThrow(ValidationError);
    await expect(setup.execute({ ...base, barcode: CODE, name: 'abc' })).rejects.toThrow(
      ValidationError,
    );
  });
});
