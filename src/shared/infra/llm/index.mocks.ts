import { EnvService } from '@shared/infra/env/env.service';

function answer(content: unknown) {
  return { data: { choices: [{ message: { content } }] } };
}
function envWith(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    llmApiKey: 'your-key',
    llmApiUrl: 'https://llm.example.com/v1/',
    llmModelLight: 'light-model',
    llmModelSearch: 'search-model',
    llmTimeoutLightMs: 6000,
    llmTimeoutSearchMs: 15000,
    ...overrides,
  } as unknown as EnvService;
}

export { answer, envWith };
