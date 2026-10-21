import { Inject } from '@nestjs/common';

import {
  ExportTransactionsInput,
  ExportTransactionsSchema,
} from '@finance/application/dto/ExportTransactions';
import { resolveExportOwners } from '@finance/application/service/ExportOwners';
import { ResolveCardRowsPaidUseCase } from '@finance/application/use-case/ResolveCardRowsPaidUseCase';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import {
  IFinanceCategoryRepository,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import {
  csvFilename,
  CsvLanguage,
  ExportRow,
  localizedPersonal,
  SYSTEM_CATEGORY_LABELS,
  toCsvRow,
  TRANSACTION_CSV_HEADERS,
} from '@finance/domain/service/TransactionCsv';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { writeCsv } from '@shared/infra/csv';
import { validate } from '@shared/infra/validation';

// Spec 047 FR 2-6: every real row of the period (system rows included, projections never) as a CSV.
export class ExportTransactionsUseCase implements UseCaseWithParams<
  ExportTransactionsInput,
  { csv: string; filename: string }
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
    @Inject(ResolveCardRowsPaidUseCase)
    private readonly resolveCardRowsPaidUseCase: ResolveCardRowsPaidUseCase,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: ExportTransactionsInput): Promise<{ csv: string; filename: string }> {
    const input = validate(ExportTransactionsSchema, params);
    const owners = resolveExportOwners(input.accessibleOwners, input.owner, input.ownerId);
    const found =
      owners.length === 0
        ? []
        : await this.transactionRepository.findTransactionsForExport({
            accountIds: input.accountIds,
            creditCardIds: input.creditCardIds,
            from: input.from,
            owners,
            to: input.to,
          });
    const transactions = await this.resolveCardRowsPaidUseCase.execute({
      today: input.today,
      transactions: found,
    });
    const categories = new Map(
      (owners.length === 0 ? [] : await this.categoryRepository.findCategories({ owners })).map(
        (category) => [category.id, category],
      ),
    );
    const rows: ExportRow[] = transactions.map((transaction) => ({
      belongsTo:
        transaction.owner === OwnerType.USER
          ? localizedPersonal(input.lang)
          : (input.ownerNames[transaction.ownerId] ?? ''),
      categoryPath: categoryPath(transaction, categories, input.lang),
      transaction,
    }));

    return {
      csv: writeCsv(
        [
          TRANSACTION_CSV_HEADERS[input.lang],
          ...rows.map((row) => toCsvRow(row, input.format, input.lang)),
        ],
        { separator: input.format === 'BR' ? ';' : ',' },
      ),
      filename: csvFilename(input.from, input.to, input.lang),
    };
  }
}

// `Parent > Child`; a system category has no owner-visible tree, so its localized label stands.
function categoryPath(
  transaction: TransactionEntity,
  categories: Map<string, CategoryEntity>,
  lang: CsvLanguage,
): string {
  if (transaction.category.systemKey) {
    return SYSTEM_CATEGORY_LABELS[lang][transaction.category.systemKey];
  }

  const names: string[] = [];
  let current = categories.get(transaction.categoryId);

  while (current) {
    names.unshift(current.name);
    current = current.parentId ? categories.get(current.parentId) : undefined;
  }

  return names.length > 0 ? names.join(' > ') : transaction.category.name;
}
