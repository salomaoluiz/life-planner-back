import { Client, Pool } from 'pg';

import { QueryCounter } from './QueryCounter';

// region Mocks / Spies

const originalQuery = Client.prototype.query;
const originalConnect = Pool.prototype.connect;
const connectStub = jest.fn();
const queryStub = jest.fn().mockResolvedValue({ rows: [] });

// endregion Mocks / Spies

beforeEach(() => {
  jest.clearAllMocks();
  QueryCounter.disable();
  Client.prototype.query = queryStub as unknown as typeof Client.prototype.query;
  Pool.prototype.connect = connectStub as unknown as typeof Pool.prototype.connect;
});

afterEach(() => {
  QueryCounter.disable();
  Client.prototype.query = originalQuery;
  Pool.prototype.connect = originalConnect;
});

function connectWithWaiting(waitingCount: number) {
  return (Pool.prototype.connect as unknown as (this: unknown) => unknown).call({ waitingCount });
}
function runQuery(...args: unknown[]) {
  return (Client.prototype.query as unknown as (...a: unknown[]) => Promise<unknown>).call(
    {},
    ...args,
  );
}

const mocks = { connectStub, queryStub };
const spies = { queryStub };

export { connectWithWaiting, mocks, QueryCounter, runQuery, spies };
