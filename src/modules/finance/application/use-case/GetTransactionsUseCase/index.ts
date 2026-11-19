import { Inject } from '@nestjs/common';

import {
  GetTransactionsInput,
  GetTransactionsSchema,
  TransactionPage,
} from '@finance/application/dto/GetTransactions';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { FindInvoicesInRangeUseCase } from '@finance/application/use-case/FindInvoicesInRangeUseCase';
import { LoadFilterCategoriesUseCase } from '@finance/application/use-case/LoadFilterCategoriesUseCase';
import { ResolveSearchCategoryIdsUseCase } from '@finance/application/use-case/ResolveSearchCategoryIdsUseCase';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionSource } from '@finance/domain/enum';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import {
  decodeTransactionCursor,
  encodeTransactionCursor,
} from '@finance/domain/service/TransactionCursor';
import { toSearchTerms } from '@finance/domain/service/TransactionSearch';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

const EMPTY_PAGE: TransactionPage = { items: [], nextCursor: null };

export class GetTransactionsUseCase implements UseCaseWithParams<
  GetTransactionsInput,
  TransactionPage
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

  async execute(params: GetTransactionsInput): Promise<TransactionPage> {
    const input = validate(GetTransactionsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return EMPTY_PAGE;
    }

    const filter = input.filter ?? {};
    const creditCardIds = [
      ...(filter.creditCardIds ?? []),
      ...(input.creditCardId ? [input.creditCardId] : []),
    ];
    const categories =
      input.preloaded?.categories ??
      (await this.loadFilterCategoriesUseCase.execute({
        accessibleOwners: input.accessibleOwners,
        filter,
      }));
    const categoryIds = filter.categoryIds?.length
      ? await this.expandCategoryIdsUseCase.execute({
          accessibleOwners: input.accessibleOwners,
          categoryIds: filter.categoryIds,
          preloaded: { categories },
        })
      : undefined;
    let invoiceData;
    let invoiceRefs;

    // Card rows belong to a period through the list date of their invoice, not their own date.
    if (input.source === TransactionSource.CARD && filter.from && filter.to) {
      const found = await this.findInvoicesInRangeUseCase.executeWithData({
        accessibleOwners: input.accessibleOwners,
        creditCardIds,
        from: filter.from,
        ownerIds: input.ownerIds,
        to: filter.to,
        today: input.today ?? new Date().toISOString().slice(0, 10),
      });

      if (found.matches.length === 0) {
        return EMPTY_PAGE;
      }

      invoiceData = found.data;
      invoiceRefs = found.matches.map(({ card, invoice }) => ({
        creditCardId: card.id,
        invoiceMonth: invoice.referenceMonth,
      }));
    }

    const cursor = input.cursor ? decodeTransactionCursor(input.cursor) : undefined;
    // Spec 084: the text search (description, notes, category with ancestors, amount) runs in SQL, so the page is
    // cut after it and is full whenever more matches exist.
    const query = filter.q?.trim();
    const search = query
      ? toSearchTerms(
          query,
          await this.resolveSearchCategoryIdsUseCase.execute({
            accessibleOwners: input.accessibleOwners,
            preloaded: { categories },
            q: query,
          }),
        )
      : null;
    const rows = await this.transactionRepository.findTransactions(owners, input.source, {
      accountIds: filter.accountIds,
      categoryIds,
      creditCardIds: creditCardIds.length > 0 ? creditCardIds : undefined,
      currency: filter.currency,
      cursor,
      from: filter.from,
      invoiceMonth: input.invoiceMonth,
      invoiceRefs,
      kind: filter.kind,
      limit: input.limit,
      paid: filter.paid,
      projected: filter.projected,
      search: search ?? undefined,
      tagIds: filter.tagIds,
      to: filter.to,
    });

    return { ...toPage(rows, input.limit), invoiceData };
  }
}

// Rows arrive in the list order; `limit + 1` rows mean a next page exists.
// Spec 119 FR 30: when the limit falls inside a split the page ends after the split's last row (the datasource
// returned those rows, plus the first row after them when more exist).
function toPage(rows: TransactionEntity[], limit: number): TransactionPage {
  let end = limit;

  while (
    end < rows.length &&
    Boolean(rows[end].splitId) &&
    rows[end].splitId === rows[end - 1].splitId
  ) {
    end += 1;
  }

  if (rows.length <= end) {
    return { items: rows, nextCursor: null };
  }

  const items = rows.slice(0, end);
  const last = items[items.length - 1];

  return {
    items,
    nextCursor: encodeTransactionCursor({
      createdAt: last.createdAt,
      date: new Date(`${last.date}T00:00:00.000Z`),
      id: last.id,
      splitId: last.splitId,
    }),
  };
}
