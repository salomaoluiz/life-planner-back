import { Inject } from '@nestjs/common';

import {
  GetTransactionsInput,
  GetTransactionsSchema,
} from '@finance/application/dto/GetTransactions';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { FindInvoicesInRangeUseCase } from '@finance/application/use-case/FindInvoicesInRangeUseCase';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionSource } from '@finance/domain/enum';
import { IFinanceTransactionRepository } from '@finance/domain/repository';
import { matchesText } from '@finance/domain/service/TextMatch';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class GetTransactionsUseCase implements UseCaseWithParams<
  GetTransactionsInput,
  TransactionEntity[]
> {
  constructor(
    @Inject(ExpandCategoryIdsUseCase)
    private readonly expandCategoryIdsUseCase: ExpandCategoryIdsUseCase,
    @Inject(FindInvoicesInRangeUseCase)
    private readonly findInvoicesInRangeUseCase: FindInvoicesInRangeUseCase,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: GetTransactionsInput): Promise<TransactionEntity[]> {
    const input = validate(GetTransactionsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    const filter = input.filter ?? {};
    const creditCardIds = [
      ...(filter.creditCardIds ?? []),
      ...(input.creditCardId ? [input.creditCardId] : []),
    ];
    const categoryIds = filter.categoryIds?.length
      ? await this.expandCategoryIdsUseCase.execute({
          accessibleOwners: input.accessibleOwners,
          categoryIds: filter.categoryIds,
        })
      : undefined;
    let invoiceRefs;

    // Card rows belong to a period through the list date of their invoice, not their own date.
    if (input.source === TransactionSource.CARD && filter.from && filter.to) {
      const matches = await this.findInvoicesInRangeUseCase.execute({
        accessibleOwners: input.accessibleOwners,
        creditCardIds,
        from: filter.from,
        ownerIds: input.ownerIds,
        to: filter.to,
        today: input.today ?? new Date().toISOString().slice(0, 10),
      });

      if (matches.length === 0) {
        return [];
      }

      invoiceRefs = matches.map(({ card, invoice }) => ({
        creditCardId: card.id,
        invoiceMonth: invoice.referenceMonth,
      }));
    }

    const rows = await this.transactionRepository.findTransactions(owners, input.source, {
      accountIds: filter.accountIds,
      categoryIds,
      creditCardIds: creditCardIds.length > 0 ? creditCardIds : undefined,
      from: filter.from,
      invoiceMonth: input.invoiceMonth,
      invoiceRefs,
      paid: filter.paid,
      tagIds: filter.tagIds,
      to: filter.to,
    });

    return filter.q ? rows.filter((row) => matchesText(row.description, filter.q as string)) : rows;
  }
}
