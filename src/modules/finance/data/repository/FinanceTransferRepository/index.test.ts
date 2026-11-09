import { mocks, setup, spies } from './index.mocks';

it('SHOULD create through the datasource with calendar dates as Date AND map the result', async () => {
  spies.create.mockResolvedValue(mocks.record);

  const result = await setup.createTransfer(mocks.params);

  expect(spies.create).toHaveBeenCalledWith(
    expect.objectContaining({
      amount_in: 92000,
      date_in: new Date('2026-11-06T00:00:00.000Z'),
      from: expect.objectContaining({ account_id: 'acc-b' }),
      occurrence_number: null,
      recurrence_id: null,
    }),
  );
  expect(result.rowIds).toEqual(['row-out', 'row-in']);
});

it('SHOULD update through the datasource', async () => {
  spies.update.mockResolvedValue(mocks.record);

  expect((await setup.updateTransfer('transfer-1', mocks.params)).id).toBe('transfer-1');
  expect(spies.update).toHaveBeenCalledWith('transfer-1', expect.any(Object));
});

it('SHOULD delete through the datasource', async () => {
  await setup.deleteTransfer('transfer-1');

  expect(spies.delete).toHaveBeenCalledWith('transfer-1');
});

it('SHOULD find a transfer AND return undefined WHEN it does not exist', async () => {
  spies.findById.mockResolvedValueOnce(mocks.record).mockResolvedValueOnce(null);

  expect((await setup.findTransferById('transfer-1'))?.id).toBe('transfer-1');
  expect(await setup.findTransferById('missing')).toBeUndefined();
});
