import { Inject } from '@nestjs/common';

import {
  GetInvoicesForListInput,
  GetInvoicesForListSchema,
} from '@finance/application/dto/GetInvoicesForList';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { FindInvoicesInRangeUseCase } from '@finance/application/use-case/FindInvoicesInRangeUseCase';
import { InvoiceDetail, splitInvoiceRows } from '@finance/application/use-case/GetInvoiceUseCase';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { hasFilter, TransactionFilter } from '@finance/domain/entity/TransactionFilter';
import { InvoiceStatus, TransactionType } from '@finance/domain/enum';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { lastDayOfMonth } from '@finance/domain/service/RecurrenceSchedule';
import { matchesText } from '@finance/domain/service/TextMatch';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// The invoices with an amount whose list day (real payment day once paid, else the planned one)
// falls in `month` (or in the filter period), each with its purchases (spec 029 FR 24).
// Archived cards are included. Spec 045: with a filter each invoice keeps only its matching rows.
export class GetInvoicesForListUseCase implements UseCaseWithParams<
  GetInvoicesForListInput,
  InvoiceDetail[]
> {
  constructor(
    @Inject(ExpandCategoryIdsUseCase)
    private readonly expandCategoryIdsUseCase: ExpandCategoryIdsUseCase,
    @Inject(FindInvoicesInRangeUseCase)
    private readonly findInvoicesInRangeUseCase: FindInvoicesInRangeUseCase,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: GetInvoicesForListInput): Promise<InvoiceDetail[]> {
    const input = validate(GetInvoicesForListSchema, params);
    const filter = input.filter ?? {};
    const range = input.month
      ? { from: `${input.month}-01`, to: lastDayOfMonth(`${input.month}-01`) }
      : { from: filter.from as string, to: filter.to as string };
    const found = await this.findInvoicesInRangeUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      creditCardIds: filter.creditCardIds,
      ownerIds: input.ownerIds,
      ...range,
      today: input.today,
    });
    // `paid` applies to the invoice; its rows follow.
    const matches = found.filter(
      ({ invoice }) =>
        filter.paid === undefined || (invoice.status === InvoiceStatus.PAID) === filter.paid,
    );

    if (matches.length === 0) {
      return [];
    }

    const rows = await this.transactionRepository.findCardPurchases(
      matches.map(({ card, invoice }) => ({
        creditCardId: card.id,
        invoiceMonth: invoice.referenceMonth,
      })),
    );
    const rowMatcher = await this.buildRowMatcher(input.accessibleOwners, filter);
    const details = matches.map(({ card, invoice }): InvoiceDetail => {
      const invoiceRows = rows.filter(
        (row) => row.creditCardId === card.id && row.invoiceMonth === invoice.referenceMonth,
      );

      if (!hasFilter(filter)) {
        return { card, ...splitInvoiceRows(invoiceRows), invoice };
      }

      const matching = invoiceRows.filter(rowMatcher.matches);

      return {
        card,
        ...splitInvoiceRows(matching),
        filtered: {
          filteredTotal: matching.reduce(
            (sum, row) => sum + (row.type === TransactionType.INCOME ? -row.value : row.value),
            0,
          ),
          matchedCount: matching.length,
          purchaseCount: invoiceRows.length,
        },
        invoice,
      };
    });

    return details
      .filter((detail) => !rowMatcher.active || (detail.filtered?.matchedCount ?? 0) > 0)
      .sort(
        (a, b) =>
          a.invoice.listDate.localeCompare(b.invoice.listDate) ||
          a.card.title.localeCompare(b.card.title),
      );
  }

  // Category (expanded), tag and text filters decide per row; the rest decided which invoices exist.
  private async buildRowMatcher(
    accessibleOwners: GetInvoicesForListInput['accessibleOwners'],
    filter: TransactionFilter,
  ) {
    const categoryIds = filter.categoryIds?.length
      ? new Set(
          await this.expandCategoryIdsUseCase.execute({
            accessibleOwners,
            categoryIds: filter.categoryIds,
          }),
        )
      : undefined;
    const tagIds = filter.tagIds?.length ? new Set(filter.tagIds) : undefined;

    return {
      active: !!categoryIds || !!tagIds || !!filter.q,
      matches: (row: TransactionEntity) =>
        (!categoryIds || categoryIds.has(row.categoryId)) &&
        (!tagIds || row.tags.some((tag) => tagIds.has(tag.id))) &&
        (!filter.q || matchesText(row.description, filter.q)),
    };
  }
}
