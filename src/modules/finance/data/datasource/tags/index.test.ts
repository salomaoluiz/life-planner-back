import {
  copyRecurrenceTags,
  copyRecurrenceTagsToRows,
  resolveTagIds,
  setRecurrenceTags,
  setTransactionTags,
  toTagRefs,
  uniqueNames,
} from './index';
import { mocks, spies } from './index.mocks';

beforeEach(() => jest.clearAllMocks());

describe('uniqueNames', () => {
  it('SHOULD collapse names that differ only by case, keeping the first spelling and order', () => {
    expect(uniqueNames(['Viagem', 'gasto', 'viagem', 'GASTO', 'novo'])).toEqual([
      'Viagem',
      'gasto',
      'novo',
    ]);
  });
});

describe('resolveTagIds', () => {
  const params = { owner: 'FAMILY' as const, ownerId: 'fam' };

  it('SHOULD return nothing WHEN there are no names', async () => {
    expect(await resolveTagIds(mocks.tx, { ...params, names: [] })).toEqual([]);
    expect(spies.findMany).not.toHaveBeenCalled();
  });

  it('SHOULD reuse the usable tag ignoring case AND prefer the single-scope one on a tie', async () => {
    spies.findMany.mockResolvedValue([
      { all_scopes: false, id: 'own', name: 'Gasto-Fixo' },
      { all_scopes: true, id: 'all', name: 'gasto-fixo' },
    ]);

    expect(await resolveTagIds(mocks.tx, { ...params, names: ['GASTO-FIXO'] })).toEqual(['own']);
    expect(spies.create).not.toHaveBeenCalled();
  });

  it('SHOULD create the missing tags as single-scope tags of the owner, in order', async () => {
    spies.findMany.mockResolvedValue([{ all_scopes: false, id: 'old', name: 'velha' }]);
    spies.create.mockResolvedValue({ id: 'new' });

    const ids = await resolveTagIds(mocks.tx, { ...params, names: ['nova', 'velha', 'NOVA'] });

    expect(ids).toEqual(['new', 'old']);
    expect(spies.create).toHaveBeenCalledTimes(1);
    expect(spies.create).toHaveBeenCalledWith({
      data: { creator_id: 'fam', name: 'nova', owner: 'FAMILY', owner_id: 'fam' },
      select: { id: true },
    });
  });
});

describe('setTransactionTags', () => {
  it('SHOULD replace the links with position = index', async () => {
    await setTransactionTags(mocks.tx, ['t1', 't2'], ['a', 'b']);

    expect(spies.trDeleteMany).toHaveBeenCalledWith({
      where: { transaction_id: { in: ['t1', 't2'] } },
    });
    expect(spies.trCreateMany).toHaveBeenCalledWith({
      data: [
        { position: 0, tag_id: 'a', transaction_id: 't1' },
        { position: 1, tag_id: 'b', transaction_id: 't1' },
        { position: 0, tag_id: 'a', transaction_id: 't2' },
        { position: 1, tag_id: 'b', transaction_id: 't2' },
      ],
    });
  });
});

describe('setRecurrenceTags', () => {
  it('SHOULD replace the series links', async () => {
    await setRecurrenceTags(mocks.tx, 'r1', ['a']);

    expect(spies.recDeleteMany).toHaveBeenCalledWith({ where: { recurrence_id: 'r1' } });
    expect(spies.recCreateMany).toHaveBeenCalledWith({
      data: [{ position: 0, recurrence_id: 'r1', tag_id: 'a' }],
    });
  });
});

describe('copyRecurrenceTagsToRows', () => {
  it('SHOULD give the untagged occurrences the tags of the series', async () => {
    spies.recFindMany.mockResolvedValue([{ position: 0, tag_id: 'a' }]);
    spies.trFindMany.mockResolvedValue([{ id: 'row-1' }]);

    await copyRecurrenceTagsToRows(mocks.tx, 'r1', { occurrence_number: { gte: 2 } });

    expect(spies.trFindMany).toHaveBeenCalledWith({
      select: { id: true },
      where: { occurrence_number: { gte: 2 }, recurrence_id: 'r1', tags: { none: {} } },
    });
    expect(spies.trCreateMany).toHaveBeenCalledWith({
      data: [{ position: 0, tag_id: 'a', transaction_id: 'row-1' }],
      skipDuplicates: true,
    });
  });

  it('SHOULD do nothing WHEN the series has no tags or there are no rows', async () => {
    spies.recFindMany.mockResolvedValue([]);
    spies.trFindMany.mockResolvedValue([{ id: 'row-1' }]);

    await copyRecurrenceTagsToRows(mocks.tx, 'r1');

    expect(spies.trCreateMany).not.toHaveBeenCalled();
  });
});

describe('copyRecurrenceTags', () => {
  it('SHOULD copy the links from one series to another', async () => {
    spies.recFindMany.mockResolvedValue([{ position: 2, tag_id: 'a' }]);

    await copyRecurrenceTags(mocks.tx, 'old', 'new');

    expect(spies.recCreateMany).toHaveBeenCalledWith({
      data: [{ position: 2, recurrence_id: 'new', tag_id: 'a' }],
      skipDuplicates: true,
    });
  });
});

describe('toTagRefs', () => {
  it('SHOULD flatten the links AND default to an empty list', () => {
    expect(toTagRefs([{ tag: { id: 'a', name: 'x' } }])).toEqual([{ id: 'a', name: 'x' }]);
    expect(toTagRefs(undefined)).toEqual([]);
  });
});
