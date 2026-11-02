import { Client } from 'pg';

import { mocks, QueryCounter, runQuery } from './QueryCounter.mocks';

describe('QueryCounter', () => {
  it('SHOULD not patch pg WHEN never enabled', () => {
    expect(QueryCounter.isEnabled()).toBe(false);
    expect(Client.prototype.query).toBe(mocks.queryStub);
  });

  it('SHOULD count each query between begin and end and list control statements apart', async () => {
    QueryCounter.enable();
    QueryCounter.begin();

    await runQuery('SELECT 1');
    await runQuery('BEGIN');
    await runQuery({ text: 'SELECT 2' });
    await runQuery('COMMIT');

    expect(QueryCounter.end()).toEqual({
      control: 2,
      statements: ['SELECT 1', 'BEGIN', 'SELECT 2', 'COMMIT'],
      total: 4,
      values: [[], [], [], []],
    });
  });

  it('SHOULD record bind values next to each statement', async () => {
    QueryCounter.enable();
    QueryCounter.begin();

    await runQuery('SELECT $1', [7]);
    await runQuery('SELECT 2');

    expect(QueryCounter.end().values).toEqual([[7], []]);
  });

  it('SHOULD ignore queries outside begin and end', async () => {
    QueryCounter.enable();

    await runQuery('SELECT 1');
    QueryCounter.begin();
    const result = QueryCounter.end();

    expect(result.total).toBe(0);
  });

  it('SHOULD forward the arguments to the original query', async () => {
    QueryCounter.enable();

    await runQuery('SELECT $1', [1]);

    expect(mocks.queryStub).toHaveBeenCalledWith('SELECT $1', [1]);
  });

  it('SHOULD be idempotent on a second enable', async () => {
    QueryCounter.enable();
    QueryCounter.enable();
    QueryCounter.begin();

    await runQuery('SELECT 1');

    expect(mocks.queryStub).toHaveBeenCalledTimes(1);
    expect(QueryCounter.end().total).toBe(1);
  });

  it('SHOULD restore the original query on disable', () => {
    QueryCounter.enable();
    QueryCounter.disable();

    expect(QueryCounter.isEnabled()).toBe(false);
    expect(Client.prototype.query).toBe(mocks.queryStub);
  });
});
