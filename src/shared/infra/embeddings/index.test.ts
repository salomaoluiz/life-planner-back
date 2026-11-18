import axios from 'axios';

import {
  Embeddings,
  EMBEDDINGS_CACHE_SIZE,
  EMBEDDINGS_CACHE_TTL_MS,
  EMBEDDINGS_QUERY_TIMEOUT_MS,
} from './index';
import { envWith, mocks } from './index.mocks';

jest.mock('axios');

const postSpy = jest.mocked(axios.post);

beforeEach(() => {
  jest.clearAllMocks();
  postSpy.mockResolvedValue(mocks.response);
});

describe('Embeddings.embed', () => {
  it('SHOULD post the normalized text with the key, the model and the dimensions AND return the vector', async () => {
    const result = await new Embeddings(envWith()).embed('  Refri  ');

    expect(result).toEqual(mocks.vector);
    expect(postSpy).toHaveBeenCalledWith(
      'https://embeddings.example.com/v1/embeddings',
      { dimensions: 4, input: 'refri', model: 'your-model' },
      { headers: { Authorization: 'Bearer your-key' }, timeout: EMBEDDINGS_QUERY_TIMEOUT_MS },
    );
  });

  it('SHOULD use the timeout of the caller', async () => {
    await new Embeddings(envWith()).embed('x', { timeoutMs: 5000 });

    expect(postSpy.mock.calls[0][2]).toMatchObject({ timeout: 5000 });
  });

  it.each([
    ['no key', { embeddingsApiKey: undefined }, 'milk'],
    ['no url', { embeddingsApiUrl: undefined }, 'milk'],
    ['no model', { embeddingsModel: undefined }, 'milk'],
    ['a blank text', {}, '   '],
  ])(
    'SHOULD return null WITHOUT calling the provider WHEN there is %s',
    async (_label, env, text) => {
      expect(await new Embeddings(envWith(env)).embed(text)).toBeNull();
      expect(postSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['the provider fails', () => postSpy.mockRejectedValue(new Error('timeout'))],
    ['the response has no vector', () => postSpy.mockResolvedValue({ data: { data: [] } })],
    [
      'the vector has the wrong size',
      () => postSpy.mockResolvedValue({ data: { data: [{ embedding: [1] }] } }),
    ],
    ['the response has no data', () => postSpy.mockResolvedValue({ data: {} })],
  ])('SHOULD return null WHEN %s', async (_label, arrange) => {
    arrange();

    expect(await new Embeddings(envWith()).embed('milk')).toBeNull();
  });

  it('SHOULD serve repeated texts from the cache until they expire', async () => {
    const service = new Embeddings(envWith());
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);

    await service.embed('milk');
    await service.embed('MILK');

    expect(postSpy).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1000 + EMBEDDINGS_CACHE_TTL_MS + 1);
    await service.embed('milk');

    expect(postSpy).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('SHOULD evict the least recently used text WHEN the cache is full', async () => {
    const service = new Embeddings(envWith());

    for (let index = 0; index <= EMBEDDINGS_CACHE_SIZE; index += 1) {
      await service.embed(`item ${index}`);
    }

    postSpy.mockClear();
    await service.embed('item 1');
    expect(postSpy).not.toHaveBeenCalled();

    await service.embed('item 0');
    expect(postSpy).toHaveBeenCalledTimes(1);
  });
});
