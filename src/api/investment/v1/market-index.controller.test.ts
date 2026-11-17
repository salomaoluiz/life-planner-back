import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './market-index.controller.mocks';

it('SHOULD read the summary of the caller', async () => {
  expect(await setup.summary(mocks.request)).toBe(mocks.result);
  expect(mocks.service.getSummary).toHaveBeenCalledWith(mocks.userId);
});

it('SHOULD read the history with a validated index AND period', async () => {
  await setup.history(mocks.request, { index: 'CDI' }, { from: '2025-11-12', to: '2026-11-12' });

  expect(mocks.service.getHistory).toHaveBeenCalledWith(
    mocks.userId,
    'CDI',
    '2025-11-12',
    '2026-11-12',
  );
});

it('SHOULD refuse an unknown index, a missing period AND a malformed date', async () => {
  const query = { from: '2025-11-12', to: '2026-11-12' };

  await expect(setup.history(mocks.request, { index: 'GOLD' }, query)).rejects.toThrow(
    ValidationError,
  );
  await expect(
    setup.history(mocks.request, { index: 'CDI' }, { from: '2025-11-12' }),
  ).rejects.toThrow(ValidationError);
  await expect(
    setup.history(mocks.request, { index: 'CDI' }, { from: '12/11/2025', to: '2026-11-12' }),
  ).rejects.toThrow(ValidationError);
  expect(mocks.service.getHistory).not.toHaveBeenCalled();
});

it('SHOULD refresh for the caller', async () => {
  expect(await setup.refresh(mocks.request)).toBe(mocks.result);
  expect(mocks.service.refresh).toHaveBeenCalledWith(mocks.userId);
});
