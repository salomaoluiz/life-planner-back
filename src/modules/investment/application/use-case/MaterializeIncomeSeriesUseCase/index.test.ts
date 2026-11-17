import { InvestmentAssetStatus } from '@investment/domain/enum';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, today: '2026-12-02' };

it('SHOULD create the planned occurrence of the new month through the gate (spec 115 FR 18-19)', async () => {
  await setup.execute(base);

  expect(spies.gate.runOnce).toHaveBeenCalledWith(['user-1'], '2026-12-02', expect.any(Function));
  expect(spies.series.materialize).toHaveBeenCalledWith({
    assetLabel: 'HGLG11',
    ended: undefined,
    lastGeneratedNumber: 24,
    occurrences: [
      {
        exDate: '2026-12-07',
        netAmount: 11000,
        number: 24,
        paymentDate: '2026-12-15',
        quantity: '100',
        received: false,
      },
    ],
    seriesId: scenario.series.id,
  });
});

it('SHOULD do nothing WHEN no series is due this month', async () => {
  await setup.execute({ ...base, today: '2026-11-20' });

  expect(spies.series.materialize).not.toHaveBeenCalled();
});

it('SHOULD end the series WHEN the position is gone AND skip archived assets and families', async () => {
  spies.investment.findAssetById.mockResolvedValue({ ...scenario.detail, operations: [] });

  await setup.execute(base);

  expect(spies.series.materialize).toHaveBeenCalledWith(
    expect.objectContaining({
      ended: { endedAt: '2026-12-15', endReason: 'POSITION_ZERO' },
      occurrences: [],
    }),
  );

  spies.series.materialize.mockClear();
  spies.investment.findAssetById.mockResolvedValue({
    ...scenario.detail,
    status: InvestmentAssetStatus.ARCHIVED,
  });
  await setup.execute(base);
  await setup.execute({
    ...base,
    accessibleOwners: scenario.owners.map((owner) => ({ ...owner, archived: true })),
  });

  expect(spies.series.materialize).not.toHaveBeenCalled();
});

it('SHOULD only materialize the requested owners', async () => {
  await setup.execute({ ...base, ownerIds: ['other'] });

  expect(spies.gate.runOnce).not.toHaveBeenCalled();
});
