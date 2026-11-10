import { Inject } from '@nestjs/common';

import {
  GetInvoicesForListInput,
  GetInvoicesForListSchema,
} from '@finance/application/dto/GetInvoicesForList';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { FindInvoicesInRangeUseCase } from '@finance/application/use-case/FindInvoicesInRangeUseCase';
import { InvoiceDetail, splitInvoiceRows } from '@finance/application/use-case/GetInvoiceUseCase';
import { LoadFilterCategoriesUseCase } from '@finance/application/use-case/LoadFilterCategoriesUseCase';
import { ResolveSearchCategoryIdsUseCase } from '@finance/application/use-case/ResolveSearchCategoryIdsUseCase';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { hasFilter, TransactionFilter } from '@finance/domain/entity/TransactionFilter';
import { InvoiceStatus, TransactionType } from '@finance/domain/enum';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { lastDayOfMonth } from '@finance/domain/service/RecurrenceSchedule';
import { toSearchTerms } from '@finance/domain/service/TransactionSearch';
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
    @Inject(LoadFilterCategoriesUseCase)
    private readonly loadFilterCategoriesUseCase: LoadFilterCategoriesUseCase,
    @Inject(ResolveSearchCategoryIdsUseCase)
    private readonly resolveSearchCategoryIdsUseCase: ResolveSearchCategoryIdsUseCase,
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
    // Spec 103: only the cards in the requested currency have invoices in that view.
    const matches = found.filter(
      ({ card, invoice }) =>
        (filter.paid === undefined || (invoice.status === InvoiceStatus.PAID) === filter.paid) &&
        (!filter.currency || card.currency === filter.currency),
    );

    if (matches.length === 0) {
      return [];
    }

    const keys = matches.map(({ card, invoice }) => ({
      creditCardId: card.id,
      invoiceMonth: invoice.referenceMonth,
    }));
    const rowMatcher = await this.buildRowMatcher(
      input.accessibleOwners,
      filter,
      input.preloaded?.categories,
    );
    // Spec 084: the text search runs in SQL, so `rows` are already the text matches; the purchase count of an
    // invoice then comes from a grouped count instead of the loaded rows.
    const [rows, counts] = await Promise.all([
      this.transactionRepository.findCardPurchases(keys, rowMatcher.search ?? undefined),
      rowMatcher.search ? this.transactionRepository.countCardPurchasesByInvoice(keys) : [],
    ]);
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
          purchaseCount: rowMatcher.search
            ? (counts.find(
                (count) =>
                  count.creditCardId === card.id && count.invoiceMonth === invoice.referenceMonth,
              )?.count ?? 0)
            : invoiceRows.length,
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
    preloadedCategories?: CategoryEntity[],
  ) {
    const categories =
      preloadedCategories ??
      (await this.loadFilterCategoriesUseCase.execute({ accessibleOwners, filter }));
    const categoryIds = filter.categoryIds?.length
      ? new Set(
          await this.expandCategoryIdsUseCase.execute({
            accessibleOwners,
            categoryIds: filter.categoryIds,
            preloaded: { categories },
          }),
        )
      : undefined;
    const tagIds = filter.tagIds?.length ? new Set(filter.tagIds) : undefined;
    const query = filter.q?.trim();
    const search = query
      ? toSearchTerms(
          query,
          await this.resolveSearchCategoryIdsUseCase.execute({
            accessibleOwners,
            preloaded: { categories },
            q: query,
          }),
        )
      : null;

    return {
      active: !!categoryIds || !!tagIds || !!filter.q,
      matches: (row: TransactionEntity) =>
        (!categoryIds || categoryIds.has(row.categoryId)) &&
        (!tagIds || row.tags.some((tag) => tagIds.has(tag.id))),
      search,
    };
  }
}
