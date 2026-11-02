import { inspectPlan } from './plan';

const opts = { indexes: ['idx_owner_date'], table: 'financial_transactions' };
const indexScan = [
  {
    Plan: {
      'Index Name': 'idx_owner_date',
      'Node Type': 'Index Scan',
      'Relation Name': 'financial_transactions',
    },
  },
];
const seqScan = [{ Plan: { 'Node Type': 'Seq Scan', 'Relation Name': 'financial_transactions' } }];

describe('inspectPlan', () => {
  it('SHOULD pass WHEN the expected index is used', () =>
    expect(inspectPlan(indexScan, opts)).toEqual([]));
  it('SHOULD flag a Seq Scan on the table and the missing index', () => {
    const violations = inspectPlan(seqScan, opts);
    expect(violations).toContain('Seq Scan on financial_transactions');
    expect(violations).toContain('index idx_owner_date not used (plan used: none)');
  });
  it('SHOULD allow the Seq Scan WHEN there is an exception', () =>
    expect(inspectPlan(seqScan, { ...opts, indexes: [], seqScanException: 'spec 078' })).toEqual(
      [],
    ));
  it('SHOULD find a nested Seq Scan', () => {
    const nested = [
      {
        Plan: {
          'Node Type': 'Hash Join',
          Plans: [{ 'Node Type': 'Seq Scan', 'Relation Name': 'financial_transactions' }],
        },
      },
    ];
    expect(inspectPlan(nested, { ...opts, indexes: [] })).toEqual([
      'Seq Scan on financial_transactions',
    ]);
  });
});
