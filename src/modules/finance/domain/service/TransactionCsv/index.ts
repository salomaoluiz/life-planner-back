import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';

export type CsvFormat = 'BR' | 'INTL';
export type CsvLanguage = 'en-US' | 'pt-BR';
export interface ExportRow {
  // `Parent > Child`; system categories use their localized label.
  categoryPath: string;
  // "Personal" (localized) or the family name.
  belongsTo: string;
  transaction: TransactionEntity;
}

// Spec 047 FR 5: the columns, in this order, in the app language.
export const TRANSACTION_CSV_HEADERS: Record<CsvLanguage, string[]> = {
  'en-US': [
    'Date',
    'Description',
    'Type',
    'Amount',
    'Currency',
    'Category',
    'Account',
    'Card',
    'Invoice',
    'Paid',
    'Tags',
    'Belongs to',
    'Installment',
    'Recurring',
  ],
  'pt-BR': [
    'Data',
    'Descrição',
    'Tipo',
    'Valor',
    'Moeda',
    'Categoria',
    'Conta',
    'Cartão',
    'Fatura',
    'Pago',
    'Tags',
    'Pertence a',
    'Parcela',
    'Recorrente',
  ],
};

export const SYSTEM_CATEGORY_LABELS: Record<CsvLanguage, Record<SystemCategoryKey, string>> = {
  'en-US': {
    [SystemCategoryKey.BALANCE_ADJUSTMENT]: 'Balance adjustment',
    [SystemCategoryKey.CARD_EARLY_PAYMENT]: 'Early payment',
    [SystemCategoryKey.CARD_REFUND]: 'Card refund',
    [SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT]: 'Prepayment discount',
    [SystemCategoryKey.INVOICE_PAYMENT]: 'Invoice payment',
  },
  'pt-BR': {
    [SystemCategoryKey.BALANCE_ADJUSTMENT]: 'Ajuste de saldo',
    [SystemCategoryKey.CARD_EARLY_PAYMENT]: 'Pagamento antecipado',
    [SystemCategoryKey.CARD_REFUND]: 'Estorno no cartão',
    [SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT]: 'Desconto de antecipação',
    [SystemCategoryKey.INVOICE_PAYMENT]: 'Pagamento de fatura',
  },
};

const WORDS: Record<
  CsvLanguage,
  { expense: string; income: string; no: string; personal: string; yes: string }
> = {
  'en-US': { expense: 'Expense', income: 'Income', no: 'No', personal: 'Personal', yes: 'Yes' },
  'pt-BR': { expense: 'Despesa', income: 'Receita', no: 'Não', personal: 'Pessoal', yes: 'Sim' },
};

export function csvFilename(from: string, to: string, lang: CsvLanguage): string {
  return `${lang === 'pt-BR' ? 'transacoes' : 'transactions'}-${from}_${to}.csv`;
}

// Positive, always 2 decimals, no thousands separator (BR: comma, INTL: point).
export function formatCsvAmount(cents: number, format: CsvFormat): string {
  const absolute = Math.abs(cents);
  const text = `${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;

  return format === 'BR' ? text.replace('.', ',') : text;
}

// `YYYY-MM-DD` → `dd/mm/yyyy` (BR) or unchanged (INTL).
export function formatCsvDate(date: string, format: CsvFormat): string {
  const [year, month, day] = date.split('-');

  return format === 'BR' ? `${day}/${month}/${year}` : date;
}
export function localizedPersonal(lang: CsvLanguage): string {
  return WORDS[lang].personal;
}
export function toCsvRow(row: ExportRow, format: CsvFormat, lang: CsvLanguage): string[] {
  const words = WORDS[lang];
  const { transaction } = row;
  function yesNo(value: boolean): string {
    return value ? words.yes : words.no;
  }

  return [
    formatCsvDate(transaction.date, format),
    transaction.description,
    transaction.type === TransactionType.INCOME ? words.income : words.expense,
    formatCsvAmount(transaction.value, format),
    transaction.currency,
    row.categoryPath,
    transaction.account?.name ?? '',
    transaction.creditCard?.title ?? '',
    transaction.invoiceMonth
      ? `${transaction.invoiceMonth.slice(5)}/${transaction.invoiceMonth.slice(0, 4)}`
      : '',
    yesNo(transaction.paid),
    transaction.tags.map((tag) => tag.name).join(' | '),
    row.belongsTo,
    transaction.installmentNumber !== null && transaction.installmentCount !== null
      ? `${transaction.installmentNumber}/${transaction.installmentCount}`
      : '',
    yesNo(transaction.recurrenceId !== null),
  ];
}
