import { BATCH_CHUNK_SIZE, BatchColumn, BatchRow, batchUpdate } from './index';
import { mocks, spies } from './index.mocks';

const MONTH: BatchColumn = { cast: 'char(7)', name: 'invoice_month' };
function rowsOf(count: number): BatchRow[] {
  return Array.from({ length: count }, (_, index) => ({ key: `id-${index}`, values: ['2026-01'] }));
}
function sqlOf(call: number): { strings: string; values: unknown[] } {
  const sql = spies.executeRaw.mock.calls[call][0] as { strings: string[]; values: unknown[] };

  return { strings: sql.strings.join('?'), values: sql.values };
}

describe('batchUpdate (spec 086)', () => {
  it('SHOULD do nothing for no rows', async () => {
    const result = await batchUpdate(mocks.tx, 'financial_transactions', 'id', [MONTH], []);

    expect(result).toBe(0);
    expect(spies.executeRaw).not.toHaveBeenCalled();
  });

  it('SHOULD build ONE parameterized statement with every value bound', async () => {
    await batchUpdate(
      mocks.tx,
      'financial_transactions',
      'id',
      [MONTH],
      [
        { key: 'id-1', values: ['2026-01'] },
        { key: 'id-2', values: ['2026-02'] },
      ],
    );

    const { strings, values } = sqlOf(0);

    expect(spies.executeRaw).toHaveBeenCalledTimes(1);
    expect(strings).toContain(
      'UPDATE "financial_transactions" AS t SET "invoice_month" = v."invoice_month" FROM (VALUES (',
    );
    expect(strings).toContain('?::text, ?::char(7)');
    expect(strings).toContain(') AS v("id", "invoice_month") WHERE t."id" = v."id"');
    expect(values).toEqual(['id-1', '2026-01', 'id-2', '2026-02']);
    expect(strings).not.toContain('2026-01');
  });

  it('SHOULD bind NULL with the cast of its column', async () => {
    const prepayment: BatchColumn = { cast: 'text', name: 'prepayment_id' };

    await batchUpdate(
      mocks.tx,
      'financial_transactions',
      'id',
      [MONTH, prepayment],
      [{ key: 'id-1', values: ['2026-01', null] }],
    );

    const { strings, values } = sqlOf(0);

    expect(values).toEqual(['id-1', '2026-01', null]);
    expect(strings).toContain('?::text, ?::char(7), ?::text');
  });

  it('SHOULD chunk at 500 rows', async () => {
    expect(BATCH_CHUNK_SIZE).toBe(500);

    await batchUpdate(mocks.tx, 'financial_transactions', 'id', [MONTH], rowsOf(500));
    expect(spies.executeRaw).toHaveBeenCalledTimes(1);

    spies.executeRaw.mockClear();
    const updated = await batchUpdate(
      mocks.tx,
      'financial_transactions',
      'id',
      [MONTH],
      rowsOf(501),
    );

    expect(spies.executeRaw).toHaveBeenCalledTimes(2);
    expect(updated).toBe(501 * 2);
  });

  it('SHOULD reject a duplicate key BEFORE any statement', async () => {
    await expect(
      batchUpdate(
        mocks.tx,
        'financial_transactions',
        'id',
        [MONTH],
        [
          { key: 'id-1', values: ['2026-01'] },
          { key: 'id-1', values: ['2026-02'] },
        ],
      ),
    ).rejects.toThrow('Duplicate key in batchUpdate: id-1');
    expect(spies.executeRaw).not.toHaveBeenCalled();
  });

  it.each([
    ['table', 'x"; DROP', 'id', 'invoice_month'],
    ['key column', 'financial_transactions', 'id"--', 'invoice_month'],
    ['column', 'financial_transactions', 'id', 'Invoice Month'],
  ])(
    'SHOULD reject an unsafe %s identifier BEFORE any statement',
    async (_, table, key, column) => {
      await expect(
        batchUpdate(mocks.tx, table, key, [{ cast: 'text', name: column }], rowsOf(1)),
      ).rejects.toThrow('Unsafe SQL identifier');
      expect(spies.executeRaw).not.toHaveBeenCalled();
    },
  );

  it('SHOULD reject a row whose values do not match the columns', async () => {
    await expect(
      batchUpdate(
        mocks.tx,
        'financial_transactions',
        'id',
        [MONTH],
        [{ key: 'id-1', values: ['2026-01', 'extra'] }],
      ),
    ).rejects.toThrow('batchUpdate row id-1 has 2 values for 1 columns');
    expect(spies.executeRaw).not.toHaveBeenCalled();
  });
});
