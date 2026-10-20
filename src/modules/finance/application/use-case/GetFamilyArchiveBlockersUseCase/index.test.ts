import { RecurrenceStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

const input = { familyId: mocks.familyId, today: mocks.today };
const owners = [{ owner: OwnerType.FAMILY, ownerId: mocks.familyId }];

function plan(months: (null | string)[]) {
  return {
    closingDay: 10,
    plan: {
      description: 'Fridge',
      id: 'plan-1',
      installments: months.map((invoiceMonth) => ({ invoiceMonth })),
    },
  };
}

it('SHOULD return empty lists and zero counts WHEN nothing is pending', async () => {
  expect(await setup.execute(input)).toEqual({
    counts: { installmentPlans: 0, invoices: 0, recurrences: 0, unpaidTransactions: 0 },
    installmentPlans: [],
    invoices: [],
    recurrences: [],
    unpaidTransactions: [],
  });
});

it('SHOULD list the ACTIVE recurrences of the family', async () => {
  mocks.recurrenceRepository.findByOwners.mockResolvedValue([
    { description: 'Rent', id: 'rec-1', nextOccurrenceDate: '2026-11-05' },
  ]);

  const result = await setup.execute(input);

  expect(mocks.recurrenceRepository.findByOwners).toHaveBeenCalledWith(owners, {
    status: RecurrenceStatus.ACTIVE,
  });
  expect(result.recurrences).toEqual([
    { description: 'Rent', id: 'rec-1', nextOccurrenceDate: '2026-11-05' },
  ]);
});

it('SHOULD list plans with installments after the card current invoice month, with the remaining count', async () => {
  // today 2026-10-20 + closing day 10 -> current invoice 2026-11
  mocks.planRepository.findPlansByOwners.mockResolvedValue([
    plan(['2026-10', '2026-11', '2026-12', '2027-01', null]),
  ]);

  const result = await setup.execute(input);

  expect(result.installmentPlans).toEqual([
    { description: 'Fridge', id: 'plan-1', remainingInstallments: 2 },
  ]);
});

it('SHOULD NOT list a plan whose installments are all up to the current invoice month', async () => {
  mocks.planRepository.findPlansByOwners.mockResolvedValue([plan(['2026-10', '2026-11'])]);

  expect((await setup.execute(input)).installmentPlans).toEqual([]);
});

it('SHOULD list unpaid invoices up to the open one, never paid or zero ones', async () => {
  mocks.compute.execute.mockResolvedValue([
    {
      card: mocks.card,
      invoices: {
        closedInvoices: [
          mocks.invoice({ referenceMonth: '2026-09' }),
          mocks.invoice({ payment: { amount: 1 }, referenceMonth: '2026-08' }),
        ],
        openInvoice: mocks.invoice({ amountDue: 0, referenceMonth: '2026-10' }),
        upcomingInvoices: [mocks.invoice({ referenceMonth: '2026-12' })],
      },
    },
  ]);

  const result = await setup.execute(input);

  expect(mocks.compute.execute).toHaveBeenCalledWith({ cards: [mocks.card], today: mocks.today });
  expect(result.invoices).toEqual([
    { amountDue: 15000, creditCardId: 'card-1', creditCardName: 'House card', month: '2026-09' },
  ]);
});

it('SHOULD list unpaid account transactions dated up to today AND ignore future or paid ones', async () => {
  mocks.transactionRepository.findTransactions.mockResolvedValue([
    mocks.row(),
    mocks.row({ date: '2026-10-20', id: 'tx-today' }),
    mocks.row({ date: '2026-10-21', id: 'tx-future' }),
    mocks.row({ id: 'tx-paid', paid: true }),
  ]);

  const result = await setup.execute(input);

  expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(owners);
  expect(result.unpaidTransactions.map((item) => item.id)).toEqual(['tx-1', 'tx-today']);
});

it('SHOULD cap each list at 20 AND keep the real total in counts', async () => {
  mocks.transactionRepository.findTransactions.mockResolvedValue(
    Array.from({ length: 25 }, (_, index) => mocks.row({ id: `tx-${index}` })),
  );

  const result = await setup.execute(input);

  expect(result.unpaidTransactions).toHaveLength(20);
  expect(result.counts.unpaidTransactions).toBe(25);
});
