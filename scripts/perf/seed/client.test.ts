import { ApiClient } from './client';

function response(status: number, body: unknown) {
  return { json: async () => body, ok: status >= 200 && status < 300, status } as Response;
}

describe('ApiClient', () => {
  it('sends the bearer token after login', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(response(200, { token: 'secret-token' }))
      .mockResolvedValueOnce(response(200, [{ id: '1' }]));
    const client = new ApiClient('http://localhost:3000', fetchFn);

    await client.login('a@example.com', 'pw');
    const result = await client.get<{ id: string }[]>('/api/v1/stock/items');

    expect(result).toEqual([{ id: '1' }]);
    expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe('Bearer secret-token');
    expect(fetchFn.mock.calls[1][0]).toBe('http://localhost:3000/api/v1/stock/items');
  });

  it('fails with method, path and status only', async () => {
    const fetchFn = jest.fn().mockResolvedValue(response(422, { message: 'a@example.com bad' }));
    const client = new ApiClient('http://localhost:3000', fetchFn);

    const error = await client.post('/api/v1/x', { a: 1 }).catch((e: Error) => e);

    expect((error as Error).message).toBe('POST /api/v1/x -> 422');
  });

  it('supports delete and signup without a body result', async () => {
    const fetchFn = jest.fn().mockResolvedValue(response(204, undefined));
    const client = new ApiClient('http://localhost:3000', fetchFn);

    await client.signup('a@example.com', 'Perf', 'pw');
    await client.delete('/api/v1/user/me');

    expect(fetchFn.mock.calls[1][1].method).toBe('DELETE');
  });
});
