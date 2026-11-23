import axios from 'axios';
import { z } from 'zod';

import { Llm } from './index';
import { answer, envWith } from './index.mocks';

jest.mock('axios');

const postSpy = jest.mocked(axios.post);
const schema = z.object({ name: z.string() });
const request = { kind: 'LIGHT' as const, schema, system: 'sys', user: 'usr' };

beforeEach(() => {
  jest.clearAllMocks();
  postSpy.mockResolvedValue(answer('{"name":"milk"}'));
});

describe('Llm.complete', () => {
  it('SHOULD post the chat request with the light model and timeout AND return the validated answer', async () => {
    expect(await new Llm(envWith()).complete(request)).toEqual({ name: 'milk' });
    expect(postSpy).toHaveBeenCalledWith(
      'https://llm.example.com/v1/chat/completions',
      {
        messages: [
          { content: 'sys', role: 'system' },
          { content: 'usr', role: 'user' },
        ],
        model: 'light-model',
        response_format: { type: 'json_object' },
        temperature: 0,
      },
      { headers: { Authorization: 'Bearer your-key' }, timeout: 6000 },
    );
  });

  it('SHOULD use the search model, the web plugin and the search timeout for SEARCH', async () => {
    await new Llm(envWith()).complete({ ...request, kind: 'SEARCH' });

    expect(postSpy.mock.calls[0][1]).toMatchObject({
      model: 'search-model',
      plugins: [{ id: 'web' }],
    });
    expect(postSpy.mock.calls[0][2]).toMatchObject({ timeout: 15000 });
  });

  it('SHOULD read an answer wrapped in a code fence', async () => {
    postSpy.mockResolvedValue(answer('```json\n{"name":"tea"}\n```'));

    expect(await new Llm(envWith()).complete(request)).toEqual({ name: 'tea' });
  });

  it.each([
    ['no key', { llmApiKey: undefined }],
    ['no url', { llmApiUrl: undefined }],
    ['no model', { llmModelLight: undefined }],
  ])('SHOULD return null WITHOUT calling the provider WHEN there is %s', async (_label, env) => {
    expect(await new Llm(envWith(env)).complete(request)).toBeNull();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['the provider fails', () => postSpy.mockRejectedValue(new Error('timeout'))],
    ['the answer is not JSON', () => postSpy.mockResolvedValue(answer('sorry'))],
    ['the answer fails the schema', () => postSpy.mockResolvedValue(answer('{"name":1}'))],
    ['there is no choice', () => postSpy.mockResolvedValue({ data: {} })],
    ['the content is not text', () => postSpy.mockResolvedValue(answer(null))],
  ])('SHOULD return null WHEN %s', async (_label, arrange) => {
    arrange();

    expect(await new Llm(envWith()).complete(request)).toBeNull();
  });
});

describe('Llm.isEnabled', () => {
  it('SHOULD depend on the model of the kind', () => {
    const llm = new Llm(envWith({ llmModelSearch: undefined }));

    expect(llm.isEnabled('LIGHT')).toBe(true);
    expect(llm.isEnabled('SEARCH')).toBe(false);
  });
});
