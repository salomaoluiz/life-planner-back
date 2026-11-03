import express from 'express';
import request from 'supertest';

import { buildCompression } from './index';

function appWith(body: string, setup?: (res: express.Response) => void) {
  const app = express();
  app.use(buildCompression());
  app.get('/data', (_req, res) => {
    setup?.(res);
    res.type('application/json').send(body);
  });

  return app;
}

const big = JSON.stringify({ items: 'a'.repeat(2000) });
const small = JSON.stringify({ ok: true });

describe('GIVEN buildCompression', () => {
  it('SHOULD gzip a 2 KB JSON body WHEN Accept-Encoding is gzip', async () => {
    const res = await request(appWith(big)).get('/data').set('Accept-Encoding', 'gzip');

    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.text).toBe(big);
  });

  it('SHOULD use brotli WHEN Accept-Encoding is br', async () => {
    const res = await request(appWith(big)).get('/data').set('Accept-Encoding', 'br');

    expect(res.headers['content-encoding']).toBe('br');
  });

  it('SHOULD NOT compress a body under 1 KB', async () => {
    const res = await request(appWith(small)).get('/data').set('Accept-Encoding', 'gzip');

    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('SHOULD NOT compress WHEN the client accepts identity only', async () => {
    const res = await request(appWith(big)).get('/data').set('Accept-Encoding', 'identity');

    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('SHOULD NOT re-compress WHEN the handler already set Content-Encoding', async () => {
    // An encoding the HTTP client does not decode, so the raw body stays readable.
    const res = await request(appWith(big, (r) => r.setHeader('Content-Encoding', 'x-custom')))
      .get('/data')
      .set('Accept-Encoding', 'gzip');

    expect(res.headers['content-encoding']).toBe('x-custom');
    expect(res.text).toBe(big);
  });
});
