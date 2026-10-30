import { mocks, setup, spies } from './index.mocks';

it('SHOULD list the whole catalog ordered by sort', async () => {
  const result = await setup.listAll();

  expect(result).toEqual([mocks.row]);
  expect(spies.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ orderBy: { sort: 'asc' } }),
  );
});

it('SHOULD search with PARAMETERS, never a concatenated statement', async () => {
  const result = await setup.search({ limit: 60, terms: ['pas', 'fol'] });

  const [sql] = spies.queryRaw.mock.calls[0] as [{ sql: string; values: unknown[] }];

  expect(result).toEqual([mocks.row]);
  expect(sql.values).toEqual(expect.arrayContaining(['pas:* & fol:*', 'pas fol', 60]));
  expect(sql.sql).not.toContain('pas:*');
  expect(sql.sql).toContain('to_tsquery');
  expect(sql.sql).toContain('?');
});

it('SHOULD fall back to trigram similarity with the 0.2 strict word threshold', async () => {
  await setup.searchSimilar({ limit: 10, text: 'psata' });

  const [sql] = spies.queryRaw.mock.calls[0] as [{ sql: string; values: unknown[] }];

  expect(sql.sql).toContain('strict_word_similarity');
  expect(sql.sql).toContain('>= 0.2');
  expect(sql.values).toEqual(expect.arrayContaining(['psata', 10]));
  expect(sql.sql).not.toContain('psata');
});
