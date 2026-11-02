import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { QueryCounter } from '@shared/infra/db/QueryCounter';

import { applyBaseline, measureRequest } from './runner';

function response(status: number, body: unknown = {}) {
  return { json: async () => body, ok: status < 400, status } as Response;
}

describe('measureRequest', () => {
  afterEach(() => jest.restoreAllMocks());

  it('SHOULD return the statements counted around the call and warm a GET up first', async () => {
    jest.spyOn(QueryCounter, 'begin').mockImplementation();
    jest
      .spyOn(QueryCounter, 'end')
      .mockReturnValue({ control: 0, statements: [], total: 7, values: [] });
    const fetchFn = jest.fn().mockResolvedValue(response(200));

    const result = await measureRequest({
      baseUrl: 'http://localhost:1',
      fetchFn,
      key: 'GET /a',
      request: { method: 'GET', path: '/a?x=1' },
      token: 't',
    });

    expect(result).toEqual({ measured: 7, status: 200 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1][0]).toBe('http://localhost:1/a?x=1');
    expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe('Bearer t');
    expect(QueryCounter.begin).toHaveBeenCalledTimes(1);
  });

  it('SHOULD call a write exactly once', async () => {
    jest.spyOn(QueryCounter, 'begin').mockImplementation();
    jest
      .spyOn(QueryCounter, 'end')
      .mockReturnValue({ control: 2, statements: [], total: 9, values: [] });
    const fetchFn = jest.fn().mockResolvedValue(response(201));

    await measureRequest({
      baseUrl: 'http://localhost:1',
      fetchFn,
      key: 'POST /a',
      request: { body: { a: 1 }, method: 'POST', path: '/a' },
      token: 't',
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][1].body).toBe('{"a":1}');
  });

  it('SHOULD hand the response body to onResponse', async () => {
    jest.spyOn(QueryCounter, 'begin').mockImplementation();
    jest
      .spyOn(QueryCounter, 'end')
      .mockReturnValue({ control: 0, statements: [], total: 1, values: [] });
    const onResponse = jest.fn();

    await measureRequest({
      baseUrl: 'http://localhost:1',
      fetchFn: jest.fn().mockResolvedValue(response(201, { id: 'x' })),
      key: 'POST /a',
      onResponse,
      request: { method: 'POST', path: '/a' },
      token: 't',
    });

    expect(onResponse).toHaveBeenCalledWith({ id: 'x' });
  });

  it('SHOULD throw the key and status only WHEN the call fails', async () => {
    jest.spyOn(QueryCounter, 'begin').mockImplementation();
    jest
      .spyOn(QueryCounter, 'end')
      .mockReturnValue({ control: 0, statements: [], total: 0, values: [] });
    const fetchFn = jest.fn().mockResolvedValue(response(500));

    await expect(
      measureRequest({
        baseUrl: 'http://localhost:1',
        fetchFn,
        key: 'GET /a',
        request: { method: 'GET', path: '/a' },
        token: 't',
      }),
    ).rejects.toThrow('GET /a -> 500');
  });
});

describe('applyBaseline', () => {
  it('SHOULD rewrite only maxQueries of the measured keys and keep the order', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'perf-baseline-')), 'stock.json');
    const original = {
      'GET /b': { kind: 'read', maxQueries: 0, scenario: '' },
      'GET /a': { kind: 'read', maxQueries: 0, scenario: 'x=1' },
      'POST /c': { kind: 'unmeasured', maxQueries: 0, reason: 'r', scenario: '' },
    };
    writeFileSync(file, JSON.stringify(original, null, 2));

    applyBaseline(file, { 'GET /a': 4 });

    const text = readFileSync(file, 'utf8');
    const written = JSON.parse(text);
    expect(Object.keys(written)).toEqual(['GET /b', 'GET /a', 'POST /c']);
    expect(written['GET /a']).toEqual({ ...original['GET /a'], maxQueries: 4 });
    expect(written['GET /b'].maxQueries).toBe(0);
    expect(text.endsWith('}\n')).toBe(true);
  });
});
