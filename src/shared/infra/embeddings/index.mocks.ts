import { EnvService } from '@shared/infra/env/env.service';

const vector = Array.from({ length: 4 }, (_, index) => index / 10);

function envWith(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    embeddingsApiKey: 'your-key',
    embeddingsApiUrl: 'https://embeddings.example.com/v1/',
    embeddingsDimensions: 4,
    embeddingsModel: 'your-model',
    ...overrides,
  } as unknown as EnvService;
}

const mocks = { response: { data: { data: [{ embedding: vector }] } }, vector };

export { envWith, mocks };
