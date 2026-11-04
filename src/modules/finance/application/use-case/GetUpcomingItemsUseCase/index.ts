import { Inject } from '@nestjs/common';
import { z } from 'zod';

import {
  GetUpcomingItemsInput,
  GetUpcomingItemsSchema,
} from '@finance/application/dto/GetUpcomingItems';
import { FindInvoicesInRangeUseCase } from '@finance/application/use-case/FindInvoicesInRangeUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import { narrowOwners, OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { UpcomingItem } from '@finance/domain/entity/UpcomingItem';
import { InvoiceStatus, TransactionType } from '@finance/domain/enum';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { addDays, lastDayOfMonth } from '@finance/domain/service/RecurrenceSchedule';
import { splitUpcoming, UpcomingSplit } from '@finance/domain/service/UpcomingItems';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Older than any real row: overdue has no lower bound (the 2-year filter window of spec 045 does not apply).
const BEGINNING = '1900-01-01';

// Spec 062 FR 21/22: what is overdue and what comes in the next days, from unpaid account rows,
// unpaid card invoices (one item each) and recurrence projections. Recurrences of the current month
// must be materialized by the caller first.
type ParsedInput = z.output<typeof GetUpcomingItemsSchema>;

export class GetUpcomingItemsUseCase implements UseCaseWithParams<
  GetUpcomingItemsInput,
  UpcomingSplit
> {
  constructor(
    @Inject(FindInvoicesInRangeUseCase)
    private readonly findInvoicesInRangeUseCase: FindInvoicesInRangeUseCase,
    @Inject(GetProjectionsUseCase)
    private readonly getProjectionsUseCase: GetProjectionsUseCase,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: GetUpcomingItemsInput): Promise<UpcomingSplit> {
    const input = validate(GetUpcomingItemsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return splitUpcoming([], input.today, input.days, input.limit);
    }

    const last = addDays(input.today, input.days);
    const [rows, invoices, projections] = await Promise.all([
      this.findRows(owners, last),
      this.findInvoices(input, last),
      this.findProjections(input, last),
    ]);

    return splitUpcoming(
      [...rows, ...invoices, ...projections],
      input.today,
      input.days,
      input.limit,
    );
  }

  // Unpaid account rows; the repository already leaves out card rows and the categories that only move money.
  private async findRows(owners: OwnerAccess[], last: string): Promise<UpcomingItem[]> {
    const rows = await this.transactionRepository.findUnpaidAccountRows(owners, last);

    return rows.map((row) => ({
      accountId: row.accountId,
      categoryId: row.categoryId,
      creditCardId: null,
      currency: row.currency,
      date: row.date,
      description: row.description,
      id: row.id,
      invoiceMonth: null,
      kind: 'TRANSACTION',
      occurrenceNumber: row.occurrenceNumber,
      owner: row.owner,
      ownerId: row.ownerId,
      purchaseCount: null,
      recurrenceId: row.recurrenceId,
      type: row.type,
      valueCents: row.value,
    }));
  }

  // One item per card and invoice month: not paid and with something left to pay.
  private async findInvoices(input: ParsedInput, last: string): Promise<UpcomingItem[]> {
    const found = await this.findInvoicesInRangeUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      from: BEGINNING,
      ownerIds: input.ownerIds,
      to: last,
      today: input.today,
    });
    const open = found.filter(
      ({ invoice }) => invoice.status !== InvoiceStatus.PAID && invoice.amountDue > 0,
    );

    if (open.length === 0) {
      return [];
    }

    const counts = await this.transactionRepository.countCardPurchasesByInvoice(
      open.map(({ card, invoice }) => ({
        creditCardId: card.id,
        invoiceMonth: invoice.referenceMonth,
      })),
    );

    return open.map(({ card, invoice }) => ({
      accountId: null,
      categoryId: null,
      creditCardId: card.id,
      currency: invoice.currency,
      date: invoice.paymentDate,
      description: card.title,
      id: `${card.id}:${invoice.referenceMonth}`,
      invoiceMonth: invoice.referenceMonth,
      kind: 'INVOICE',
      occurrenceNumber: null,
      owner: card.owner,
      ownerId: card.ownerId,
      purchaseCount:
        counts.find(
          (row) => row.creditCardId === card.id && row.invoiceMonth === invoice.referenceMonth,
        )?.count ?? 0,
      recurrenceId: null,
      type: TransactionType.EXPENSE,
      valueCents: invoice.amountDue,
    }));
  }

  // Projections only exist after the current month; account series only (card ones sit in their invoice).
  private async findProjections(input: ParsedInput, last: string): Promise<UpcomingItem[]> {
    if (last <= lastDayOfMonth(input.today)) {
      return [];
    }

    const projections = await this.getProjectionsUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      from: input.today.slice(0, 7),
      ownerIds: input.ownerIds,
      to: last.slice(0, 7),
      today: input.today,
    });

    return projections
      .filter((item) => item.creditCard === null && item.date <= last)
      .map((item) => ({
        accountId: item.account?.id ?? null,
        categoryId: item.category.id,
        creditCardId: null,
        currency: item.currency,
        date: item.date,
        description: item.description,
        id: `${item.recurrenceId}:${item.occurrenceNumber}`,
        invoiceMonth: null,
        kind: 'PROJECTION',
        occurrenceNumber: item.occurrenceNumber,
        owner: item.owner,
        ownerId: item.ownerId,
        purchaseCount: null,
        recurrenceId: item.recurrenceId,
        type: item.type,
        valueCents: item.value,
      }));
  }
}
