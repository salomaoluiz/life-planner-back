import { expandPath, expandScenario, Fixtures, resolveFixtures } from './fixtures';

const fx: Fixtures = {
  account: 'acc-1',
  card: 'card-1',
  category: undefined,
  family: 'fam-1',
  plan: 'plan-1',
  recurrence: 'rec-1',
  referenceMonth: '2026-02',
  stockItem: 'stock-1',
  tag: 'tag-1',
  userId: 'user-1',
};

describe('expandScenario', () => {
  it('SHOULD replace the month and user tokens', () => {
    expect(
      expandScenario(
        'from={monthStart}&to={monthEnd}&m={referenceMonth}&n={nextMonth}&o={userId}',
        fx,
      ),
    ).toBe('from=2026-02-01&to=2026-02-28&m=2026-02&n=2026-03&o=user-1');
  });

  it('SHOULD roll the next month over the year and handle leap years', () => {
    const december = { ...fx, referenceMonth: '2027-12' };
    expect(expandScenario('{nextMonth}', december)).toBe('2028-01');
    expect(expandScenario('{monthEnd}', { ...fx, referenceMonth: '2028-02' })).toBe('2028-02-29');
  });

  it('SHOULD replace the family token with the first family', () => {
    expect(expandScenario('familyId={familyId}', fx)).toBe('familyId=fam-1');
  });
});

describe('expandPath', () => {
  it('SHOULD replace :name by the fixture the param names', () => {
    expect(
      expandPath(
        '/api/v1/finance/credit-cards/:id/invoices/:month',
        { id: 'card', month: 'referenceMonth' },
        fx,
      ),
    ).toBe('/api/v1/finance/credit-cards/card-1/invoices/2026-02');
  });

  it('SHOULD throw WHEN a fixture is missing', () => {
    expect(() => expandPath('/x/:id', { id: 'category' }, fx)).toThrow(
      'fixture "category" missing',
    );
  });
});

describe('resolveFixtures', () => {
  it('SHOULD take the first element of each list endpoint', async () => {
    const client = {
      get: jest.fn(async (path: string) => {
        if (path.endsWith('/transactions?source=ACCOUNT&limit=1')) return [];
        if (path.includes('/transactions'))
          return [{ installmentPlanId: null }, { installmentPlanId: 'plan-9' }];

        return [{ id: `first:${path}` }, { id: 'second' }];
      }),
    };

    const result = await resolveFixtures(
      client as never,
      {
        referenceMonth: '2026-02',
        userId: 'user-1',
      } as never,
    );

    expect(result.account).toBe('first:/api/v1/finance/accounts');
    expect(result.card).toBe('first:/api/v1/finance/credit-cards');
    expect(result.stockItem).toBe('first:/api/v1/stock/items');
    expect(result.family).toBe('first:/api/v1/families');
    expect(result.plan).toBe('plan-9');
    expect(result.userId).toBe('user-1');
    expect(result.referenceMonth).toBe('2026-02');
  });
});
