import axios from 'axios';
import { z } from 'zod';

import { LogLevel } from '@shared/infra/logger/types';

import { Llm } from './index';
import { answer, envWith } from './index.mocks';

jest.mock('axios');

const postSpy = jest.mocked(axios.post);
const logger = { log: jest.fn() };
const schema = z.object({ name: z.string() });
const request = { kind: 'LIGHT' as const, schema, system: 'sys', user: 'usr' };

beforeEach(() => {
  jest.clearAllMocks();
  postSpy.mockResolvedValue(answer('{"name":"milk"}'));
});

describe('Llm.complete', () => {
  it('SHOULD post the chat request with the light model and timeout AND return the validated answer', async () => {
    expect(await new Llm(envWith(), logger).complete(request)).toEqual({ name: 'milk' });
    expect(postSpy).toHaveBeenCalledWith(
      'https://llm.example.com/v1/chat/completions',
      {
        max_tokens: 400,
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
    await new Llm(envWith(), logger).complete({ ...request, kind: 'SEARCH' });

    expect(postSpy.mock.calls[0][1]).toMatchObject({
      max_tokens: 800,
      model: 'search-model',
      plugins: [{ id: 'web' }],
    });
    expect(postSpy.mock.calls[0][2]).toMatchObject({ timeout: 15000 });
  });

  it('SHOULD read an answer wrapped in a code fence', async () => {
    postSpy.mockResolvedValue(answer('```json\n{"name":"tea"}\n```'));

    expect(await new Llm(envWith(), logger).complete(request)).toEqual({ name: 'tea' });
  });

  it.each([
    ['no key', { llmApiKey: undefined }],
    ['no url', { llmApiUrl: undefined }],
    ['no model', { llmModelLight: undefined }],
  ])('SHOULD return null WITHOUT calling the provider WHEN there is %s', async (_label, env) => {
    expect(await new Llm(envWith(env), logger).complete(request)).toBeNull();
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

    expect(await new Llm(envWith(), logger).complete(request)).toBeNull();
  });
});

describe('Llm.isEnabled', () => {
  it('SHOULD depend on the model of the kind', () => {
    const llm = new Llm(envWith({ llmModelSearch: undefined }), logger);

    expect(llm.isEnabled('LIGHT')).toBe(true);
    expect(llm.isEnabled('SEARCH')).toBe(false);
  });
});

describe('Llm failures are logged', () => {
  it('SHOULD log the status and the provider message WITHOUT the key or the prompt', async () => {
    postSpy.mockRejectedValue({
      response: { data: { error: { message: 'Provider returned error' } }, status: 402 },
    });

    expect(await new Llm(envWith(), logger).complete(request)).toBeNull();
    expect(logger.log).toHaveBeenCalledWith(
      LogLevel.WARN,
      'LLM call failed',
      expect.objectContaining({ kind: 'LIGHT', message: 'Provider returned error', status: '402' }),
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain('your-key');
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain('usr');
  });

  it('SHOULD log an answer that fails the schema', async () => {
    postSpy.mockResolvedValue(answer('{"name":1}'));

    await new Llm(envWith(), logger).complete(request);

    expect(logger.log).toHaveBeenCalledWith(
      LogLevel.WARN,
      'LLM call failed',
      expect.objectContaining({ status: 'invalid-answer' }),
    );
  });
});

describe('Llm search fallback to Google AI Studio', () => {
  const google = {
    googleAiApiKey: 'your-google-key',
    googleAiApiUrl: 'https://google.example.com/v1beta/',
    googleAiSearchModel: 'gemini-test',
  };
  const search = { ...request, kind: 'SEARCH' as const };

  function googleAnswer(text: string) {
    return { data: { candidates: [{ content: { parts: [{ text }] } }] } };
  }

  it('SHOULD use OpenRouter FIRST and NOT call Google WHEN it answers', async () => {
    const result = await new Llm(envWith(google), logger).complete(search);

    expect(result).toEqual({ name: 'milk' });
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0][0]).toBe('https://llm.example.com/v1/chat/completions');
  });

  it('SHOULD fall back to Google with the Google Search tool WHEN OpenRouter fails AND log both', async () => {
    postSpy
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Insufficient credits' } }, status: 402 },
      })
      .mockResolvedValueOnce(googleAnswer('```json\n{"name":"tea"}\n```'));

    const result = await new Llm(envWith(google), logger).complete(search);

    expect(result).toEqual({ name: 'tea' });
    expect(postSpy).toHaveBeenLastCalledWith(
      'https://google.example.com/v1beta/models/gemini-test:generateContent',
      expect.objectContaining({
        systemInstruction: { parts: [{ text: 'sys' }] },
        tools: [{ google_search: {} }],
      }),
      { headers: { 'x-goog-api-key': 'your-google-key' }, timeout: 15000 },
    );
    expect(logger.log).toHaveBeenCalledWith(
      LogLevel.WARN,
      'LLM call failed',
      expect.objectContaining({ provider: 'OPENROUTER', status: '402' }),
    );
  });

  it('SHOULD fall back WHEN OpenRouter answers something that is not the expected JSON', async () => {
    postSpy
      .mockResolvedValueOnce(answer('sorry'))
      .mockResolvedValueOnce(googleAnswer('{"name":"tea"}'));

    expect(await new Llm(envWith(google), logger).complete(search)).toEqual({ name: 'tea' });
  });

  it('SHOULD return null WHEN both providers fail', async () => {
    postSpy.mockRejectedValue(new Error('down'));

    expect(await new Llm(envWith(google), logger).complete(search)).toBeNull();
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('SHOULD work with only the Google key for the search AND never use Google for the light call', async () => {
    const llm = new Llm(
      envWith({
        ...google,
        llmApiKey: undefined,
        llmModelLight: undefined,
        llmModelSearch: undefined,
      }),
      logger,
    );

    expect(llm.isEnabled('SEARCH')).toBe(true);
    expect(llm.isEnabled('LIGHT')).toBe(false);

    postSpy.mockResolvedValue(googleAnswer('{"name":"tea"}'));

    expect(await llm.complete(search)).toEqual({ name: 'tea' });
  });
});
