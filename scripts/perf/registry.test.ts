import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadRegistry, parseRegistryKey, routeKey } from './registry';

const base = {
  indexes: null,
  kind: 'read',
  maxBytes: null,
  maxQueries: 3,
  p50Ms: null,
  scenario: '',
};

function dirWith(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'perf-registry-'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(content));
  }

  return dir;
}

describe('routeKey / parseRegistryKey', () => {
  it('SHOULD build and parse keys with and without scenario', () => {
    expect(routeKey('GET', '/api/v1/stock/items')).toBe('GET /api/v1/stock/items');
    expect(routeKey('GET', '/api/v1/finance/transactions', 'month')).toBe(
      'GET /api/v1/finance/transactions #month',
    );
    expect(parseRegistryKey('GET /api/v1/finance/transactions #month')).toEqual({
      method: 'GET',
      scenario: 'month',
      template: '/api/v1/finance/transactions',
    });
    expect(parseRegistryKey('DELETE /api/v1/stock/items/:id')).toEqual({
      method: 'DELETE',
      scenario: undefined,
      template: '/api/v1/stock/items/:id',
    });
  });

  it('SHOULD throw WHEN a key does not look like METHOD /path', () => {
    expect(() => parseRegistryKey('stock items')).toThrow('stock items');
  });
});

describe('loadRegistry', () => {
  it('SHOULD load a valid registry from a directory', () => {
    const dir = dirWith({ stock: { 'GET /api/v1/stock/items': base } });

    const registry = loadRegistry(dir, ['stock']);

    expect(registry.stock['GET /api/v1/stock/items'].maxQueries).toBe(3);
  });

  it('SHOULD throw naming file and key WHEN maxQueries is negative', () => {
    const dir = dirWith({ stock: { 'GET /api/v1/stock/items': { ...base, maxQueries: -1 } } });

    expect(() => loadRegistry(dir, ['stock'])).toThrow(/stock\.json.*GET \/api\/v1\/stock\/items/);
  });

  it('SHOULD throw WHEN unmeasured has no reason', () => {
    const dir = dirWith({
      stock: { 'GET /api/v1/stock/items': { ...base, kind: 'unmeasured', maxQueries: 0 } },
    });

    expect(() => loadRegistry(dir, ['stock'])).toThrow('reason');
  });

  it('SHOULD throw WHEN write has no recipe', () => {
    const dir = dirWith({ stock: { 'POST /api/v1/stock/items': { ...base, kind: 'write' } } });

    expect(() => loadRegistry(dir, ['stock'])).toThrow('recipe');
  });

  it('SHOULD throw WHEN a key does not match METHOD /path', () => {
    const dir = dirWith({ stock: { items: base } });

    expect(() => loadRegistry(dir, ['stock'])).toThrow('items');
  });

  it('SHOULD throw WHEN the file is missing', () => {
    expect(() => loadRegistry(dirWith({}), ['stock'])).toThrow('stock.json');
  });
});

describe('loadRegistry optional perf:check fields', () => {
  it('SHOULD accept knownException, seqScanException and table', () => {
    const dir = dirWith({
      health: {
        'GET /api/health': {
          ...base,
          knownException: 'spec 078',
          seqScanException: 'spec 078',
          table: 'financial_transactions',
        },
      },
    });
    expect(loadRegistry(dir, ['health']).health['GET /api/health'].table).toBe(
      'financial_transactions',
    );
  });

  it('SHOULD reject a non-string knownException', () => {
    const dir = dirWith({ health: { 'GET /api/health': { ...base, knownException: 3 } } });
    expect(() => loadRegistry(dir, ['health'])).toThrow('perf registry');
  });
});
