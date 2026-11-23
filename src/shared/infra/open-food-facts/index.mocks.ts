import { EnvService } from '@shared/infra/env/env.service';

function envWith(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    openFoodFactsTimeoutMs: 2000,
    openFoodFactsUrl: 'https://off.example.com/',
    openFoodFactsUserAgent: 'LifePlanner/1.0',
    ...overrides,
  } as unknown as EnvService;
}

const found = {
  data: {
    product: {
      brands: 'Marca, Outra',
      categories_tags: ['en:milks'],
      product_name: ' Leite integral ',
      quantity: '1 L',
    },
    status: 1,
  },
  status: 200,
};

export { envWith, found };
