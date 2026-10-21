import { ForbiddenException, Inject, UnprocessableEntityException } from '@nestjs/common';

import {
  ImportRow,
  ImportTransactionsInput,
  ImportTransactionsSchema,
} from '@finance/application/dto/ImportTransactions';
import {
  duplicateKey,
  ImportRowError,
  mapConsistencyError,
  normalizeTags,
  validateImportRow,
} from '@finance/application/service/ImportRows';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import {
  ConsistencyResult,
  EnsureTransactionConsistencyUseCase,
} from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import {
  CreateTransactionRepositoryParams,
  IFinanceTransactionRepository,
} from '@finance/domain/repository';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface ImportTransactionsResult {
  created: number;
  // Line numbers of the rows that look like transactions the owner already has (dry run only).
  duplicates: number[];
  errors: ImportRowError[];
}

// Spec 047 §7: a dry run reports every row error and the possible duplicates; the real run writes all rows in ONE
// database transaction, or nothing (422 with the errors).
export class ImportTransactionsUseCase implements UseCaseWithParams<
  ImportTransactionsInput,
  ImportTransactionsResult
> {
  constructor(
    @Inject(EnsureTransactionConsistencyUseCase)
    private readonly ensureTransactionConsistencyUseCase: EnsureTransactionConsistencyUseCase,
    @Inject('IFinanceTransactionRepository')
    private readonly transactionRepository: IFinanceTransactionRepository,
  ) {}

  async execute(params: ImportTransactionsInput): Promise<ImportTransactionsResult> {
    const input = validate(ImportTransactionsSchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    if (!hasOwnerAccess(input.accessibleOwners, target)) {
      throw new ForbiddenException('Owner not accessible');
    }

    ensureOwnerWritable(input.accessibleOwners, target);

    const errors: ImportRowError[] = [];
    const checked: { consistency: ConsistencyResult; row: ImportRow }[] = [];
    const lookups = new Map<string, Promise<ConsistencyResult | ImportRowError>>();
    const wellFormed: ImportRow[] = [];

    for (const row of input.rows) {
      const invalid = validateImportRow(row);

      if (invalid) {
        errors.push(invalid);
        continue;
      }

      wellFormed.push(row);

      // 2,000 rows share a handful of categories and accounts: each combination is looked up once.
      const key = [row.categoryId, row.accountId, row.creditCardId, row.type, row.currency].join(
        '|',
      );
      const lookup = lookups.get(key) ?? this.lookup(row, input, row.line);

      lookups.set(key, lookup);

      const result = await lookup;

      if ('code' in result) {
        errors.push({ ...result, line: row.line });
      } else {
        checked.push({ consistency: result, row });
      }
    }

    errors.sort((a, b) => a.line - b.line);

    if (!input.dryRun) {
      if (errors.length > 0) {
        throw new UnprocessableEntityException({ errors, message: 'The import has invalid rows' });
      }

      const created = await this.transactionRepository.createManyTransactions(
        checked.map(({ consistency, row }) => toCreateParams(row, consistency, input)),
      );

      return { created, duplicates: [], errors: [] };
    }

    return { created: 0, duplicates: await this.findDuplicates(wellFormed, target), errors };
  }

  private async findDuplicates(
    rows: ImportRow[],
    owner: { owner: ImportTransactionsInput['owner']; ownerId: string },
  ): Promise<number[]> {
    if (rows.length === 0) {
      return [];
    }

    const dates = rows.map((row) => row.date).sort();
    const existing = await this.transactionRepository.findDuplicateCandidates({
      from: dates[0],
      owner,
      to: dates[dates.length - 1],
    });
    const seen = new Set(existing.map((candidate) => duplicateKey(candidate)));
    const duplicates: number[] = [];

    for (const row of rows) {
      const key = duplicateKey(row);

      if (seen.has(key)) {
        duplicates.push(row.line);
      } else {
        seen.add(key);
      }
    }

    return duplicates.sort((a, b) => a - b);
  }

  private async lookup(
    row: ImportRow,
    input: {
      accessibleOwners: ImportTransactionsInput['accessibleOwners'];
      owner: ImportTransactionsInput['owner'];
      ownerId: string;
    },
    line: number,
  ): Promise<ConsistencyResult | ImportRowError> {
    try {
      return await this.ensureTransactionConsistencyUseCase.execute({
        accessibleOwners: input.accessibleOwners,
        accountId: row.accountId ?? undefined,
        blockArchivedAccount: true,
        blockArchivedCategory: true,
        categoryId: row.categoryId,
        creditCardId: row.creditCardId ?? undefined,
        currency: (row.currency ?? undefined) as CurrencyCode | undefined,
        owner: input.owner,
        ownerId: input.ownerId,
        type: row.type,
      });
    } catch (error) {
      const mapped = mapConsistencyError(error, line);

      if (mapped) {
        return mapped;
      }

      throw error;
    }
  }
}

function toCreateParams(
  row: ImportRow,
  { account, card }: ConsistencyResult,
  input: { owner: ImportTransactionsInput['owner']; ownerId: string; today: string },
): CreateTransactionRepositoryParams {
  const tags = normalizeTags(row.tags);

  return {
    accountId: row.accountId ?? undefined,
    categoryId: row.categoryId,
    creditCardId: row.creditCardId ?? undefined,
    currency: (card ?? (account as NonNullable<typeof account>)).currency,
    date: row.date,
    description: row.description.trim(),
    invoiceMonth: card ? invoiceMonthOf(row.date, card.closingDay) : undefined,
    owner: input.owner,
    ownerId: input.ownerId,
    // Card rows derive it from their invoice; account rows are paid when dated up to today unless the file says so.
    paid: card ? undefined : (row.paid ?? row.date <= input.today),
    tags: tags.length > 0 ? tags : undefined,
    type: row.type,
    value: row.value,
  };
}
