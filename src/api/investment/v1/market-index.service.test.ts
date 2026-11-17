import { MarketIndex } from '@investment/domain/enum';

import { setup, spies } from './market-index.service.mocks';

const owners = [
  { owner: 'USER', ownerId: 'user-1' },
  { archived: true, owner: 'FAMILY', ownerId: 'family-1' },
];

it('SHOULD read the summary for the user AND every family they can read (archived ones too)', async () => {
  spies.summary.mockResolvedValue({ cdi: null });

  expect(await setup.getSummary('user-1')).toEqual({ cdi: null });
  expect(spies.summary).toHaveBeenCalledWith({
    accessibleOwners: owners,
    today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  });
});

it('SHOULD read the history of an index in a period for the same owners', async () => {
  spies.history.mockResolvedValue({ points: [] });

  await setup.getHistory('user-1', MarketIndex.IPCA, '2025-11-12', '2026-11-12');

  expect(spies.history).toHaveBeenCalledWith({
    accessibleOwners: owners,
    from: '2025-11-12',
    index: 'IPCA',
    to: '2026-11-12',
    today: expect.any(String),
  });
});

it('SHOULD refresh first AND answer the new summary', async () => {
  spies.summary.mockResolvedValue({ cdi: { annual: '14.90' } });

  expect(await setup.refresh('user-1')).toEqual({ cdi: { annual: '14.90' } });
  expect(spies.refresh).toHaveBeenCalledWith({ userId: 'user-1' });
  expect(spies.refresh.mock.invocationCallOrder[0]).toBeLessThan(
    spies.summary.mock.invocationCallOrder[0],
  );
});
