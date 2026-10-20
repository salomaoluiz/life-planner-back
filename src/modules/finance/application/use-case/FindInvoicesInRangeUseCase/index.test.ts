import { mocks, setup } from './index.mocks';

it('SHOULD return the invoices whose list date is inside the range', async () => {
  const result = await setup.execute(mocks.input);

  expect(result).toHaveLength(1);
  expect(result[0].card).toBe(mocks.card);
  expect(result[0].invoice.referenceMonth).toBe('2026-10');
});

it('SHOULD leave out an invoice listed outside the range', async () => {
  expect(await setup.execute({ ...mocks.input, from: '2026-12-01', to: '2026-12-31' })).toEqual([]);
});

it('SHOULD keep only the chosen cards', async () => {
  await setup.execute({ ...mocks.input, creditCardIds: ['other-card'] });
  expect(mocks.compute.execute).toHaveBeenLastCalledWith({ cards: [], today: mocks.input.today });

  await setup.execute({ ...mocks.input, creditCardIds: [mocks.card.id] });
  expect(mocks.compute.execute).toHaveBeenLastCalledWith({
    cards: [mocks.card],
    today: mocks.input.today,
  });
});

it('SHOULD return [] WITHOUT reading cards WHEN no requested owner is accessible', async () => {
  expect(await setup.execute({ ...mocks.input, ownerIds: ['stranger'] })).toEqual([]);
  expect(mocks.creditCardRepository.findCreditCards).not.toHaveBeenCalled();
});
