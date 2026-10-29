import { Inject } from '@nestjs/common';

import {
  GetDashboardRowsInput,
  GetDashboardRowsSchema,
} from '@finance/application/dto/GetDashboardRows';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { TransactionSource, TransactionType } from '@finance/domain/enum';
import {
  IFinanceCreditCardRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { addInvoiceMonths, buildInvoiceFor } from '@finance/domain/service/InvoiceCalculator';
import { lastDayOfMonth } from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// One grouped amount that counts in the dashboard, already placed on its counting date (spec 046 §5.3).
export interface DashboardRow {
  amount: number;
  // `YYYY-MM-DD` the amount counts on: the row date, or the date its invoice was paid / is expected.
  bucketDate: string;
  categoryId: string;
  count: number;
  projected: boolean;
  tagId: null | string;
  type: TransactionType;
}

interface CountedInvoice {
  date: string;
  realized: boolean;
}

// Spec 046 FR 5-9: account rows on their date, card rows on the date their invoice was paid (unpaid invoice → its
// list date, projected). Unpaid rows of earlier months are never counted; the current month's unpaid rows are projected.
export class GetDashboardRowsUseCase implements UseCaseWithParams<
  GetDashboardRowsInput,
  DashboardRow[]
> {
  constructor(
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject(ExpandCategoryIdsUseCase)
    private readonly expandCategoryIdsUseCase: ExpandCategoryIdsUseCase,
    @Inject(GetProjectionsUseCase)
    private readonly getProjectionsUseCase: GetProjectionsUseCase,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: GetDashboardRowsInput): Promise<DashboardRow[]> {
    const input = validate(GetDashboardRowsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    const filter = input.filter ?? {};
    const source = effectiveSource(filter);
    const monthStart = `${input.today.slice(0, 7)}-01`;
    const categoryIds = filter.categoryIds?.length
      ? await this.expandCategoryIdsUseCase.execute({
          accessibleOwners: input.accessibleOwners,
          categoryIds: filter.categoryIds,
        })
      : undefined;
    const invoices =
      source === TransactionSource.ACCOUNT
        ? new Map<string, CountedInvoice>()
        : await this.countedInvoices({
            creditCardIds: filter.creditCardIds,
            from: input.from,
            owners,
            paid: filter.paid,
            to: input.to,
            today: input.today,
          });
    const sums = await this.transactionRepository.sumDashboardRows({
      accountIds: filter.accountIds,
      byTag: input.byTag,
      categoryIds,
      creditCardIds: filter.creditCardIds,
      currency: input.currency,
      from: input.from,
      invoiceRefs: [...invoices.keys()].map((key) => {
        const [creditCardId, invoiceMonth] = key.split('|');

        return { creditCardId, invoiceMonth };
      }),
      owners,
      q: filter.q,
      source,
      tagIds: filter.tagIds,
      to: input.to,
    });

    const stored = sums.flatMap((sum) => {
      const counted = countedOf(sum, invoices);

      if (!counted || (!counted.realized && counted.date < monthStart)) {
        return [];
      }
      if (filter.paid !== undefined && counted.realized !== filter.paid) {
        return [];
      }

      return [
        {
          amount: sum.amount,
          bucketDate: counted.date,
          categoryId: sum.categoryId,
          count: sum.count,
          projected: !counted.realized,
          tagId: sum.tagId,
          type: sum.type,
        },
      ];
    });

    return [...stored, ...(await this.projectedRows(input, source))];
  }

  // Spec 053 FR 11: the recurrence occurrences after the end of the current month exist only as projections.
  // A series ends when its source is archived (spec 034), so the active-only lookup already follows the 052 rule.
  private async projectedRows(
    input: GetDashboardRowsInput,
    source: TransactionSource | undefined,
  ): Promise<DashboardRow[]> {
    const filter = input.filter ?? {};
    const horizon = lastDayOfMonth(input.today);

    if (filter.paid === true || input.to <= horizon) {
      return [];
    }

    const todayMonth = input.today.slice(0, 7);
    const firstMonth = addInvoiceMonths(todayMonth, 1);
    const fromMonth = input.from.slice(0, 7) > firstMonth ? input.from.slice(0, 7) : firstMonth;
    const occurrences = await this.getProjectionsUseCase.executeChunked({
      accessibleOwners: input.accessibleOwners,
      filter: {
        accountIds: filter.accountIds,
        categoryIds: filter.categoryIds,
        creditCardIds: filter.creditCardIds,
        q: filter.q,
        tagIds: filter.tagIds,
      },
      from: fromMonth,
      ownerIds: input.ownerIds,
      to: input.to.slice(0, 7),
      today: input.today,
    });

    return occurrences.flatMap((item) => {
      const onCard = item.creditCard !== null;
      const date = onCard ? item.invoiceListDate : item.date;

      if (
        !date ||
        date < input.from ||
        date > input.to ||
        item.currency !== input.currency ||
        (source === TransactionSource.ACCOUNT && onCard) ||
        (source === TransactionSource.CARD && !onCard)
      ) {
        return [];
      }

      const tagIds = input.byTag && item.tags.length > 0 ? item.tags.map((tag) => tag.id) : [null];

      return tagIds.map((tagId) => ({
        amount: item.value,
        bucketDate: date,
        categoryId: item.category.id,
        count: 1,
        projected: true,
        tagId,
        type: item.type,
      }));
    });
  }

  // The invoices that count in [from, to]: key `cardId|YYYY-MM` → the date they count on.
  private async countedInvoices(params: {
    creditCardIds?: string[];
    from: string;
    owners: ReturnType<typeof narrowOwners>;
    paid?: boolean;
    to: string;
    today: string;
  }): Promise<Map<string, CountedInvoice>> {
    const wanted = params.creditCardIds?.length ? new Set(params.creditCardIds) : undefined;
    const cards = (await this.creditCardRepository.findCreditCards(params.owners)).filter(
      (card) => !wanted || wanted.has(card.id),
    );
    const data = await this.computeCardInvoicesUseCase.execute({ cards, today: params.today });
    const monthStart = `${params.today.slice(0, 7)}-01`;
    const counted = new Map<string, CountedInvoice>();

    for (const item of data) {
      const months = new Set([
        ...item.payments.map((payment) => payment.referenceMonth),
        ...item.totals.map((total) => total.invoiceMonth),
      ]);

      for (const month of months) {
        const invoice = buildInvoiceFor(item.card, month, item.totals, item.payments, params.today);
        // A paid invoice counts on the day it was paid; one covered by credits and early payments on its due date.
        const realized = invoice.payment !== null || invoice.amountDue <= 0;
        const date = invoice.payment?.paidOn ?? (realized ? invoice.dueDate : invoice.paymentDate);

        if (date < params.from || date > params.to || (!realized && date < monthStart)) {
          continue;
        }

        counted.set(`${item.card.id}|${month}`, { date, realized });
      }
    }

    return counted;
  }
}

function countedOf(
  sum: {
    creditCardId: null | string;
    date: null | string;
    invoiceMonth: null | string;
    paid: boolean | null;
  },
  invoices: Map<string, CountedInvoice>,
): CountedInvoice | undefined {
  if (sum.creditCardId && sum.invoiceMonth) {
    return invoices.get(`${sum.creditCardId}|${sum.invoiceMonth}`);
  }

  return sum.date ? { date: sum.date, realized: sum.paid === true } : undefined;
}

// Accounts picked without cards (or the other way around) narrow the sources to what was picked.
function effectiveSource(filter: {
  accountIds?: string[];
  creditCardIds?: string[];
  source?: TransactionSource;
}): TransactionSource | undefined {
  if (filter.source) {
    return filter.source;
  }
  if (filter.accountIds?.length && !filter.creditCardIds?.length) {
    return TransactionSource.ACCOUNT;
  }

  return filter.creditCardIds?.length && !filter.accountIds?.length
    ? TransactionSource.CARD
    : undefined;
}
