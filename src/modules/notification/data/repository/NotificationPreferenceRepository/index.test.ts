import { NotificationPreferenceRepository } from './index';

const row = {
  bill_lead_days: 3,
  disabled_types: [],
  invoice_lead_days: 3,
  last_summary_on: null,
  locale: 'pt-BR',
  quiet_end_minute: 420,
  quiet_start_minute: 1320,
  summary_minute: 480,
  time_zone: 'America/Sao_Paulo',
  user_id: 'user-1',
};
const datasource = {
  deleteFamily: jest.fn(),
  find: jest.fn(),
  findDisabledFamilies: jest.fn(),
  findDue: jest.fn(),
  setFamily: jest.fn(),
  setLastSummaryOn: jest.fn(),
  upsert: jest.fn(),
};
const setup = new NotificationPreferenceRepository(datasource as never);

beforeEach(() => jest.clearAllMocks());

it('SHOULD answer the defaults WHEN the user has no row (FR 35)', async () => {
  datasource.find.mockResolvedValue(null);

  expect(await setup.find('user-1')).toEqual(
    expect.objectContaining({ summaryMinute: 480, userId: 'user-1' }),
  );
});

it('SHOULD map the stored row', async () => {
  datasource.find.mockResolvedValue({ ...row, summary_minute: 540 });

  expect((await setup.find('user-1')).summaryMinute).toBe(540);
});

it('SHOULD group the disabled families by user', async () => {
  datasource.findDisabledFamilies.mockResolvedValue([
    { family_id: 'f1', user_id: 'u1' },
    { family_id: 'f2', user_id: 'u1' },
    { family_id: 'f1', user_id: 'u2' },
  ]);

  const result = await setup.findDisabledFamilyIds(['u1', 'u2']);

  expect([...(result.get('u1') ?? [])]).toEqual(['f1', 'f2']);
  expect([...(result.get('u2') ?? [])]).toEqual(['f1']);
});

it('SHOULD map the due users', async () => {
  datasource.findDue.mockResolvedValue([row]);

  expect(await setup.findDueUsers(new Date(), undefined, 200)).toEqual([
    expect.objectContaining({ userId: 'user-1' }),
  ]);
});

it('SHOULD translate a patch into columns AND forward family and summary writes', async () => {
  datasource.upsert.mockResolvedValue(row);

  await setup.save('user-1', { billLeadDays: 5, summaryMinute: 540, timeZone: 'UTC' });
  await setup.setFamilyEnabled('user-1', 'f1', false);
  await setup.setLastSummaryOn('user-1', '2026-11-23');
  await setup.removeFamily('user-1', 'f1');

  expect(datasource.upsert).toHaveBeenCalledWith(
    'user-1',
    expect.objectContaining({ bill_lead_days: 5, summary_minute: 540, time_zone: 'UTC' }),
  );
  expect(datasource.setFamily).toHaveBeenCalledWith('user-1', 'f1', false);
  expect(datasource.setLastSummaryOn).toHaveBeenCalledWith('user-1', '2026-11-23');
  expect(datasource.deleteFamily).toHaveBeenCalledWith('user-1', 'f1');
});
