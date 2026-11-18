import { params, setup, spies, sqlOf } from './index.mocks';

describe('findSuggestions', () => {
  it('SHOULD set the trigram threshold for the transaction AND query the owner only, trigram signal only without an embedding', async () => {
    spies.queryRaw.mockResolvedValueOnce([]);
    spies.queryRaw.mockResolvedValueOnce([{ id: 'a' }]);

    expect(await setup.findSuggestions(params)).toEqual([{ id: 'a' }]);

    expect(sqlOf(spies.queryRaw.mock.calls[0])).toContain('pg_trgm.word_similarity_threshold');
    expect(spies.queryRaw.mock.calls[0][0].values).toEqual(['0.3']);

    const sql = sqlOf(spies.queryRaw.mock.calls[1]);

    expect(sql).toContain('<%');
    expect(sql).toContain('"owner_id" =');
    expect(sql).not.toContain('<=>');
    expect(spies.queryRaw.mock.calls[1][0].values).toContain('user');
  });

  it('SHOULD add the cosine signal WHEN an embedding is given', async () => {
    await setup.findSuggestions({ ...params, embedding: [0.1, 0.2] });

    const statement = spies.queryRaw.mock.calls[1][0];

    expect(statement.sql).toContain('<=>');
    expect(statement.values).toContain('[0.1,0.2]');
  });
});

describe('embeddings', () => {
  it('SHOULD read the text sent to the provider (name and brand only)', async () => {
    spies.queryRaw.mockResolvedValue([{ text: ' Milk Brand ' }]);

    expect(await setup.findEmbeddingText('x')).toBe('Milk Brand');
    expect(sqlOf(spies.queryRaw.mock.calls[0])).not.toContain('notes');

    spies.queryRaw.mockResolvedValue([]);
    expect(await setup.findEmbeddingText('x')).toBeNull();
  });

  it('SHOULD list the items without a vector, oldest first', async () => {
    spies.queryRaw.mockResolvedValue([{ id: 'a', text: 'Milk' }]);

    expect(await setup.findWithoutEmbedding(50)).toEqual([{ id: 'a', text: 'Milk' }]);
    expect(sqlOf(spies.queryRaw.mock.calls[0])).toContain('"name_embedding" IS NULL');
  });

  it('SHOULD store the vector as a pgvector literal', async () => {
    await setup.setEmbedding('x', [1, 2]);

    expect(spies.executeRaw.mock.calls[0][0].values).toEqual(['[1,2]', 'x']);
  });
});
