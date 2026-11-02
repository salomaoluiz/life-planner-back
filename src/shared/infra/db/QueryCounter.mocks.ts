import { Client } from 'pg';

import { QueryCounter } from './QueryCounter';

// region Mocks / Spies

const originalQuery = Client.prototype.query;
const queryStub = jest.fn().mockResolvedValue({ rows: [] });

// endregion Mocks / Spies

beforeEach(() => {
  jest.clearAllMocks();
  QueryCounter.disable();
  Client.prototype.query = queryStub as unknown as typeof Client.prototype.query;
});

afterEach(() => {
  QueryCounter.disable();
  Client.prototype.query = originalQuery;
});

function runQuery(...args: unknown[]) {
  return (Client.prototype.query as unknown as (...a: unknown[]) => Promise<unknown>).call(
    {},
    ...args,
  );
}

const mocks = { queryStub };
const spies = { queryStub };

export { mocks, QueryCounter, runQuery, spies };
