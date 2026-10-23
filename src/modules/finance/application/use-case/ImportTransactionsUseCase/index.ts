import { ForbiddenException, Inject, UnprocessableEntityException } from '@nestjs/common';

import {
  ImportRow,
  ImportTransactionsInput,
  ImportTransactionsSchema,
} from '@finance/application/dto/ImportTransactions';
import {
  CardRowItem,
  evaluateCardRows,
  ImportInvoiceSummary,
} from '@finance/application/service/ImportCardRows';
import {
  duplicateKey,
  ImportRowError,
  mapConsistencyError,
  normalizeTags,
  validateImportRow,
} from '@finance/application/service/ImportRows';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import {
  ConsistencyResult,
  EnsureTransactionConsistencyUseCase,
} from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { AccountStatus, InvoicePaymentMethod, SystemCategoryKey } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import {
  CreateEarlyPaymentRepositoryParams,
  CreateRefundRepositoryParams,
  CreateTransactionRepositoryParams,
  IFinanceAccountRepository,
  IFinanceCardCreditRepository,
  IFinanceCreditCardRepository,
  IFinanceTransactionRepository,
  PayInvoiceRepositoryParams,
} from '@finance/domain/repository';
import { defaultPaymentInvoiceMonth } from '@finance/domain/service/ImportInvoiceMath';
import {
  importRowKind,
  ImportRowKind,
  parseInvoiceMonth,
} from '@finance/domain/service/ImportRowKind';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface ImportTransactionsResult {
  created: number;
  // Line numbers of the rows that look like transactions the owner already has (dry run only).
  duplicates: number[];
  errors: ImportRowError[];
  // Spec 048 FR 24: the invoices the file touches (dry run, only when it has card credits or payments).
  invoices: ImportInvoiceSummary[];
}

interface CardLookup {
  card: CreditCardEntity;
  paidFrom?: AccountEntity;
}
interface CheckedRow {
  cardLookup?: CardLookup;
  consistency?: ConsistencyResult;
  kind: ImportRowKind;
  row: ImportRow;
}

const CREDIT_KINDS: ImportRowKind[] = [
  'EARLY_PAYMENT',
  'INVOICE_PAYMENT',
  'PREPAYMENT_DISCOUNT',
  'REFUND',
];

// Spec 047 §7: a dry run reports every row error and the possible duplicates; the real run writes all rows in ONE
// database transaction, or nothing (422 with the errors).
export class ImportTransactionsUseCase implements UseCaseWithParams<
  ImportTransactionsInput,
  ImportTransactionsResult
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCardCreditRepository')
    private readonly cardCreditRepository: IFinanceCardCreditRepository,
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
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
    const checked: CheckedRow[] = [];
    const lookups = new Map<string, Promise<ConsistencyResult | ImportRowError>>();
    const cardLookups = new Map<string, Promise<CardLookup | ImportRowError>>();
    const wellFormed: ImportRow[] = [];

    for (const row of input.rows) {
      const invalid = validateImportRow(row);

      if (invalid) {
        errors.push(invalid);
        continue;
      }

      // Spec 047: a row can belong to another owner than the request (Personal and a family in one file).
      const rowTarget = targetOf(row, input);
      const access = input.accessibleOwners.find(
        (item) => item.owner === rowTarget.owner && item.ownerId === rowTarget.ownerId,
      );

      if (!access || access.archived) {
        errors.push({
          code: access ? 'OWNER_ARCHIVED' : 'OWNER_NOT_ACCESSIBLE',
          line: row.line,
          message: access ? 'Family is archived' : 'Owner not accessible',
        });
        continue;
      }

      wellFormed.push(row);

      const kind = importRowKind(row) as ImportRowKind;

      // Spec 048: refunds, discounts, early payments and invoice payments use system categories, so they skip the
      // category rules of a plain transaction and are checked against their card (and paid-from account).
      if (CREDIT_KINDS.includes(kind)) {
        const key = [
          rowTarget.owner,
          rowTarget.ownerId,
          row.creditCardId,
          paidFromId(row, kind),
          row.currency,
          kind === 'EARLY_PAYMENT' && row.date > input.today,
        ].join('|');
        const lookup = cardLookups.get(key) ?? this.lookupCard(row, kind, input);

        cardLookups.set(key, lookup);

        const result = await lookup;

        if ('code' in result) {
          errors.push({ ...result, line: row.line });
        } else {
          checked.push({ cardLookup: result, kind, row });
        }

        continue;
      }

      // 2,000 rows share a handful of categories and accounts: each combination is looked up once.
      const key = [
        rowTarget.owner,
        rowTarget.ownerId,
        row.categoryId,
        row.accountId,
        row.creditCardId,
        row.type,
        row.currency,
      ].join('|');
      const lookup = lookups.get(key) ?? this.lookup(row, input, row.line);

      lookups.set(key, lookup);

      const result = await lookup;

      if ('code' in result) {
        errors.push({ ...result, line: row.line });
      } else {
        checked.push({ consistency: result, kind, row });
      }
    }

    // Duplicates first: a row that repeats an existing one is not written, so it stays out of the invoice math.
    const keyDuplicates = input.dryRun
      ? await this.findDuplicates(
          wellFormed.filter((row) => importRowKind(row) !== 'INVOICE_PAYMENT'),
          input,
        )
      : [];
    const duplicates = new Set(keyDuplicates);
    // A duplicate the user chose to import is written, so it counts in the invoice math (it stays reported).
    const included = new Set(input.includeDuplicates ?? []);
    const excluded = new Set([...duplicates].filter((line) => !included.has(line)));
    const cardRows = await this.evaluateCardRows(checked, excluded, input);

    errors.push(...cardRows.errors);

    for (const line of cardRows.duplicateLines) {
      duplicates.add(line);
    }

    errors.sort((a, b) => a.line - b.line);

    if (!input.dryRun) {
      if (errors.length > 0) {
        throw new UnprocessableEntityException({ errors, message: 'The import has invalid rows' });
      }

      return {
        created: await this.write(checked, cardRows.months, input),
        duplicates: [],
        errors: [],
        invoices: [],
      };
    }

    return {
      created: 0,
      duplicates: [...duplicates].sort((a, b) => a - b),
      errors,
      invoices: cardRows.invoices,
    };
  }

  // Resolves the invoice of each card row (FR 8) and runs the whole-file checks of FR 14-17.
  private async evaluateCardRows(
    checked: CheckedRow[],
    duplicates: Set<number>,
    input: { today: string },
  ) {
    const months = new Map<number, string>();
    const cardRows = checked.filter(({ cardLookup }) => cardLookup !== undefined);
    const hasCredits = checked.some(({ kind }) => CREDIT_KINDS.includes(kind));
    const empty = {
      duplicateLines: [] as number[],
      errors: [] as ImportRowError[],
      invoices: [],
      months,
    };

    if (!hasCredits) {
      return empty;
    }

    const items: CardRowItem[] = [];
    const cards = new Map<string, CreditCardEntity>();
    const invalid: ImportRowError[] = [];

    for (const entry of [...cardRows, ...checked.filter(({ consistency }) => consistency?.card)]) {
      const card = (entry.cardLookup?.card ?? entry.consistency?.card) as CreditCardEntity;
      const month = invoiceMonthFor(entry, card);

      if (month === 'INVALID') {
        invalid.push({
          code: 'INVOICE_MONTH_INVALID',
          line: entry.row.line,
          message: 'Invalid invoice month',
        });
        continue;
      }

      cards.set(card.id, card);
      months.set(entry.row.line, month);
      items.push({
        card,
        date: entry.row.date,
        invoiceMonth: month,
        kind: entry.kind,
        line: entry.row.line,
        value: entry.row.value,
      });
    }

    const data = await this.computeCardInvoicesUseCase.execute({
      cards: [...cards.values()],
      today: input.today,
    });
    const evaluated = evaluateCardRows({
      data,
      duplicateLines: duplicates,
      items,
      today: input.today,
    });

    return { ...evaluated, errors: [...invalid, ...evaluated.errors], months };
  }

  private async lookupCard(
    row: ImportRow,
    kind: ImportRowKind,
    input: {
      accessibleOwners: ImportTransactionsInput['accessibleOwners'];
      owner: ImportTransactionsInput['owner'];
      ownerId: string;
      today: string;
    },
  ): Promise<CardLookup | ImportRowError> {
    const target = targetOf(row, input);
    const card = await this.creditCardRepository.findCreditCardById(row.creditCardId as string);

    if (
      !card ||
      !hasOwnerAccess(input.accessibleOwners, card) ||
      card.owner !== target.owner ||
      card.ownerId !== target.ownerId
    ) {
      return { code: 'CARD_NOT_FOUND', line: row.line, message: 'Credit card not found' };
    }

    if (card.status === AccountStatus.ARCHIVED) {
      return { code: 'ACCOUNT_ARCHIVED', line: row.line, message: 'Credit card is archived' };
    }

    if (row.currency && row.currency !== card.currency) {
      return {
        code: 'CURRENCY_MISMATCH',
        line: row.line,
        message: 'Transaction currency must match the credit card currency',
      };
    }

    if (kind === 'EARLY_PAYMENT' && row.date > input.today) {
      return { code: 'INVALID_DATE', line: row.line, message: 'The date cannot be after today' };
    }

    const accountId = paidFromId(row, kind);

    if (!accountId) {
      return { card };
    }

    const account = await this.accountRepository.findAccountById(accountId);

    if (
      !account ||
      !hasOwnerAccess(input.accessibleOwners, account) ||
      account.status === AccountStatus.ARCHIVED ||
      account.currency !== card.currency
    ) {
      return {
        code: 'PAID_FROM_ACCOUNT_INVALID',
        line: row.line,
        message: 'The account must be active, yours and in the card currency',
      };
    }

    return { card, paidFrom: account };
  }

  // Spec 048 FR 19: purchases and account rows, then refunds and discounts, early payments, invoice payments.
  private async write(
    checked: CheckedRow[],
    months: Map<number, string>,
    input: { owner: ImportTransactionsInput['owner']; ownerId: string; today: string },
  ): Promise<number> {
    const plain = checked
      .filter(({ cardLookup }) => !cardLookup)
      .map(({ consistency, row }) =>
        toCreateParams(row, consistency as ConsistencyResult, input, months.get(row.line)),
      );

    if (!checked.some(({ kind }) => CREDIT_KINDS.includes(kind))) {
      return this.transactionRepository.createManyTransactions(plain);
    }

    function of(kind: ImportRowKind) {
      return checked.filter((entry) => entry.kind === kind && entry.cardLookup);
    }

    return this.cardCreditRepository.createImportRows({
      earlyPayments: of('EARLY_PAYMENT').map((entry) =>
        toEarlyPayment(entry, months.get(entry.row.line) as string),
      ),
      payments: of('INVOICE_PAYMENT').map((entry) =>
        toInvoicePayment(entry, months.get(entry.row.line) as string),
      ),
      purchases: plain,
      refunds: [...of('REFUND'), ...of('PREPAYMENT_DISCOUNT')].map((entry) =>
        toRefund(entry, months.get(entry.row.line) as string),
      ),
    });
  }

  // Duplicates are looked for in the owner of each row, and within the rows of that owner.
  private async findDuplicates(
    rows: ImportRow[],
    defaults: { owner: ImportTransactionsInput['owner']; ownerId: string },
  ): Promise<number[]> {
    const groups = new Map<string, ImportRow[]>();

    for (const row of rows) {
      const target = targetOf(row, defaults);
      const key = `${target.owner}|${target.ownerId}`;

      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    const duplicates: number[] = [];

    for (const group of groups.values()) {
      const owner = targetOf(group[0], defaults);
      const dates = group.map((row) => row.date).sort();
      const existing = await this.transactionRepository.findDuplicateCandidates({
        from: dates[0],
        owner,
        to: dates[dates.length - 1],
      });
      const seen = new Set(existing.map((candidate) => duplicateKey(candidate)));

      for (const row of group) {
        const key = duplicateKey(row);

        if (seen.has(key)) {
          duplicates.push(row.line);
        } else {
          seen.add(key);
        }
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
        owner: targetOf(row, input).owner,
        ownerId: targetOf(row, input).ownerId,
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

// The invoice a card row lands on: the file's month, else by the closing day; payments by the due date (FR 8).
function invoiceMonthFor(
  entry: { kind?: ImportRowKind; row: ImportRow },
  card: CreditCardEntity,
): 'INVALID' | string {
  const given = parseInvoiceMonth(entry.row.invoiceMonth);

  if (given) {
    return given;
  }

  return entry.kind === 'EARLY_PAYMENT' || entry.kind === 'INVOICE_PAYMENT'
    ? defaultPaymentInvoiceMonth(entry.row.date, card)
    : invoiceMonthOf(entry.row.date, card.closingDay);
}

// The account an early payment or an invoice payment is paid from, if any.
function paidFromId(row: ImportRow, kind: ImportRowKind): string | undefined {
  return kind === 'EARLY_PAYMENT' || kind === 'INVOICE_PAYMENT'
    ? (row.paidFromAccountId ?? row.accountId ?? undefined)
    : undefined;
}
function targetOf(
  row: ImportRow,
  defaults: { owner: ImportTransactionsInput['owner']; ownerId: string },
) {
  return {
    owner: row.owner ?? defaults.owner,
    ownerId: row.ownerId ?? defaults.ownerId,
  };
}
function toCreateParams(
  row: ImportRow,
  { account, card }: ConsistencyResult,
  input: { owner: ImportTransactionsInput['owner']; ownerId: string; today: string },
  month?: string,
): CreateTransactionRepositoryParams {
  const tags = normalizeTags(row.tags);

  return {
    accountId: row.accountId ?? undefined,
    categoryId: row.categoryId,
    creditCardId: row.creditCardId ?? undefined,
    currency: (card ?? (account as NonNullable<typeof account>)).currency,
    date: row.date,
    description: row.description.trim(),
    invoiceMonth: card ? (month ?? invoiceMonthFor({ row }, card)) : undefined,
    owner: targetOf(row, input).owner,
    ownerId: targetOf(row, input).ownerId,
    // Card rows derive it from their invoice; account rows are paid when dated up to today unless the file says so.
    paid: card ? undefined : (row.paid ?? row.date <= input.today),
    tags: tags.length > 0 ? tags : undefined,
    type: row.type,
    value: row.value,
  };
}
function toEarlyPayment(
  entry: CheckedRow,
  invoiceMonth: string,
): CreateEarlyPaymentRepositoryParams {
  const { card, paidFrom } = entry.cardLookup as CardLookup;

  return {
    account: paidFrom && { id: paidFrom.id, owner: paidFrom.owner, ownerId: paidFrom.ownerId },
    accountCategoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.INVOICE_PAYMENT],
    accountDescription: `Early payment · ${card.title} (${invoiceMonth})`,
    categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_EARLY_PAYMENT],
    creditCardId: card.id,
    currency: card.currency,
    date: entry.row.date,
    description: entry.row.description.trim(),
    // The import checked the invoice against the whole file; the datasource does not compare it again.
    expectedNet: 0,
    invoiceMonth,
    method: paidFrom ? InvoicePaymentMethod.ACCOUNT : InvoicePaymentMethod.EXTERNAL,
    owner: card.owner,
    ownerId: card.ownerId,
    value: entry.row.value,
  };
}
function toInvoicePayment(entry: CheckedRow, invoiceMonth: string): PayInvoiceRepositoryParams {
  const { card, paidFrom } = entry.cardLookup as CardLookup;

  return {
    accountId: paidFrom?.id,
    accountOwner: paidFrom && { owner: paidFrom.owner, ownerId: paidFrom.ownerId },
    amount: entry.row.value,
    categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.INVOICE_PAYMENT],
    creditCardId: card.id,
    currency: card.currency,
    description: `Invoice payment · ${card.title} (${invoiceMonth})`,
    // The import checked the invoice against the whole file; the datasource does not compare it again.
    expectedNet: 0,
    invoiceMonth,
    method: paidFrom ? InvoicePaymentMethod.ACCOUNT : InvoicePaymentMethod.EXTERNAL,
    owner: card.owner,
    ownerId: card.ownerId,
    paidOn: entry.row.date,
  };
}
function toRefund(entry: CheckedRow, invoiceMonth: string): CreateRefundRepositoryParams {
  const { card } = entry.cardLookup as CardLookup;
  const key =
    entry.kind === 'REFUND'
      ? SystemCategoryKey.CARD_REFUND
      : SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT;

  return {
    categoryId: SYSTEM_CATEGORY_IDS[key],
    creditCardId: card.id,
    currency: card.currency,
    date: entry.row.date,
    description: entry.row.description.trim(),
    invoiceMonth,
    owner: card.owner,
    ownerId: card.ownerId,
    value: entry.row.value,
  };
}
