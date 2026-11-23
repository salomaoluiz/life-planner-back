import axios from 'axios';

import { OPEN_FOOD_FACTS_CACHE_SIZE, OPEN_FOOD_FACTS_CACHE_TTL_MS, OpenFoodFacts } from './index';
import { envWith, found } from './index.mocks';

jest.mock('axios');

const getSpy = jest.mocked(axios.get);

beforeEach(() => {
  jest.clearAllMocks();
  getSpy.mockResolvedValue(found);
});

describe('OpenFoodFacts.getProduct', () => {
  it('SHOULD read the product with the user agent, fields and timeout AND map it', async () => {
    const product = await new OpenFoodFacts(envWith()).getProduct('7891000100103');

    expect(product).toEqual({
      brands: 'Marca, Outra',
      categories: ['en:milks'],
      name: 'Leite integral',
      quantity: '1 L',
    });
    expect(getSpy).toHaveBeenCalledWith(
      'https://off.example.com/api/v2/product/7891000100103.json',
      expect.objectContaining({
        headers: { 'User-Agent': 'LifePlanner/1.0' },
        params: { fields: 'product_name,brands,quantity,categories_tags' },
        timeout: 2000,
      }),
    );
  });

  it.each([
    ['a 404', { data: {}, status: 404 }],
    ['status 0', { data: { status: 0 }, status: 200 }],
    ['a product without name', { data: { product: { brands: 'x' }, status: 1 }, status: 200 }],
  ])('SHOULD return null WHEN the response is %s', async (_label, response) => {
    getSpy.mockResolvedValue(response);

    expect(await new OpenFoodFacts(envWith()).getProduct('1')).toBeNull();
  });

  it('SHOULD return undefined WITHOUT caching WHEN the call fails', async () => {
    const service = new OpenFoodFacts(envWith());

    getSpy.mockRejectedValueOnce(new Error('timeout'));
    expect(await service.getProduct('1')).toBeUndefined();
    expect(await service.getProduct('1')).toMatchObject({ name: 'Leite integral' });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('SHOULD serve repeated codes from the cache until it expires', async () => {
    const service = new OpenFoodFacts(envWith());
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);

    await service.getProduct('1');
    await service.getProduct('1');
    expect(getSpy).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1000 + OPEN_FOOD_FACTS_CACHE_TTL_MS + 1);
    await service.getProduct('1');
    expect(getSpy).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('SHOULD evict the least recently used code WHEN the cache is full', async () => {
    const service = new OpenFoodFacts(envWith());

    for (let index = 0; index <= OPEN_FOOD_FACTS_CACHE_SIZE; index += 1) {
      await service.getProduct(`code${index}`);
    }

    getSpy.mockClear();
    await service.getProduct('code1');
    expect(getSpy).not.toHaveBeenCalled();

    await service.getProduct('code0');
    expect(getSpy).toHaveBeenCalledTimes(1);
  });
});
