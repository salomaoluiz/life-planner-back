import {
  CreateConversionApiSchema,
  UpdateConversionApiSchema,
} from '@api/investment/v1/dto/conversion.dto';

const id = '1c7b2f8d-4a5e-4c3b-9dae-2f3a4b5c6d7e';

describe('CreateConversionApiSchema', () => {
  const conversion = {
    date: '2026-10-15',
    destination: { assetId: id },
    ratioFrom: '1',
    ratioTo: '7.4',
  };

  it('SHOULD accept an existing destination AND a new one with a cash part', () => {
    expect(CreateConversionApiSchema.safeParse(conversion).success).toBe(true);
    expect(
      CreateConversionApiSchema.safeParse({
        ...conversion,
        accountId: id,
        cashAmount: 1500,
        cashReferenceUnitValue: '10.40',
        destination: { newAsset: { name: 'Fundo Exemplo', ticker: 'XPTO11' } },
        generateTransaction: true,
      }).success,
    ).toBe(true);
  });

  it.each([
    { ratioTo: 7.4 },
    { ratioFrom: '1,5' },
    { date: '15/10/2026' },
    { cashAmount: 0 },
    { destination: { assetId: 'x' } },
    { destination: { assetId: id, newAsset: { name: 'a', ticker: 'B' } } },
    { quantity: '1' },
  ])('SHOULD reject %j', (override) => {
    expect(CreateConversionApiSchema.safeParse({ ...conversion, ...override }).success).toBe(false);
  });
});

describe('UpdateConversionApiSchema', () => {
  it('SHOULD accept any subset AND a null cash part', () => {
    expect(UpdateConversionApiSchema.safeParse({}).success).toBe(true);
    expect(UpdateConversionApiSchema.safeParse({ cashAmount: null, ratioTo: '2' }).success).toBe(
      true,
    );
  });

  it('SHOULD reject a destination (it cannot change)', () => {
    expect(UpdateConversionApiSchema.safeParse({ destination: { assetId: id } }).success).toBe(
      false,
    );
  });
});
