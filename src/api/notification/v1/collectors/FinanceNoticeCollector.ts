import { Injectable } from '@nestjs/common';

import { CollectRequest, INoticeCollector, stateOf } from '@api/notification/v1/collectors/types';
import { GetAccountsByIdsUseCase } from '@finance/application/use-case/GetAccountsByIdsUseCase';
import { GetUpcomingItemsUseCase } from '@finance/application/use-case/GetUpcomingItemsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { UpcomingItem } from '@finance/domain/entity/UpcomingItem';
import { TransactionType } from '@finance/domain/enum';
import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';
import { addDaysToDate } from '@notification/domain/service/NotificationClock';

// FR 6 and 2: the widest window a user can choose, and how late an unpaid item still notifies.
const WINDOW_DAYS = 30;
const OVERDUE_DAYS = 30;
const LIMIT = 1000;

// Spec 124 FR 1, 4, 6: FINANCE_BILL_DUE (unpaid EXPENSE account row or recurrence projection, never a card row) and
// FINANCE_INVOICE_DUE (open card invoice). Income never notifies. Reads through 062 (`GetUpcomingItemsUseCase`) after the
// 081 materialization; the per-user lead days are applied later by `filterItemsForUser`.
@Injectable()
export class FinanceNoticeCollector implements INoticeCollector {
  constructor(
    private readonly getAccountsByIdsUseCase: GetAccountsByIdsUseCase,
    private readonly getUpcomingItemsUseCase: GetUpcomingItemsUseCase,
    private readonly materializeRecurrencesUseCase: MaterializeRecurrencesUseCase,
  ) {}

  async collect(request: CollectRequest): Promise<NotificationItemInput[]> {
    const accessibleOwners = request.owners;

    if (accessibleOwners.length === 0) {
      return [];
    }

    await this.materializeRecurrencesUseCase.execute({
      accessibleOwners,
      today: request.localDate,
    });

    const upcoming = await this.getUpcomingItemsUseCase.execute({
      accessibleOwners,
      days: WINDOW_DAYS,
      limit: LIMIT,
      today: request.localDate,
    });
    const earliest = addDaysToDate(request.localDate, -OVERDUE_DAYS);
    const candidates = [...upcoming.overdue, ...upcoming.next].filter(
      (item) =>
        item.type === TransactionType.EXPENSE && item.date >= earliest && isNotifiable(item),
    );
    const accountIds = [
      ...new Set(candidates.flatMap((item) => (item.accountId ? [item.accountId] : []))),
    ];
    const accounts = await this.getAccountsByIdsUseCase.execute({
      accessibleOwners,
      ids: accountIds,
    });
    const accountNames = new Map(accounts.map((account) => [account.id, account.name]));

    return candidates.map((item) => ({
      dueDate: item.date,
      module: 'FINANCE',
      owner: item.owner,
      ownerId: item.ownerId,
      route: routeOf(item),
      snapshot: {
        accountName: item.accountId ? accountNames.get(item.accountId) : undefined,
        cardName: item.kind === 'INVOICE' ? item.description : undefined,
        currency: item.currency,
        description: item.description,
        ownerName: request.ownerNames[item.ownerId],
        valueCents: item.valueCents,
      },
      sourceId: item.id,
      state: stateOf(item.date, request.localDate),
      type: item.kind === 'INVOICE' ? 'FINANCE_INVOICE_DUE' : 'FINANCE_BILL_DUE',
    }));
  }
}

// An invoice, or an account row/projection; a card row is never a bill of its own (it sits in its invoice).
function isNotifiable(item: UpcomingItem): boolean {
  return item.kind === 'INVOICE' || item.creditCardId === null;
}
function routeOf(item: UpcomingItem): string {
  if (item.kind === 'INVOICE') {
    return `/credit-cards/${item.creditCardId}/invoices/${item.invoiceMonth}`;
  }

  return item.kind === 'PROJECTION'
    ? `/finance/recurrences/${item.recurrenceId}/occurrences/${item.occurrenceNumber}`
    : `/finance/transactions/${item.id}`;
}
