export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}
export enum AccountType {
  BROKERAGE = 'BROKERAGE',
  CASH = 'CASH',
  CHECKING = 'CHECKING',
  OTHER = 'OTHER',
  SAVINGS = 'SAVINGS',
}
export enum CreditCardBrand {
  AMEX = 'AMEX',
  ELO = 'ELO',
  MASTERCARD = 'MASTERCARD',
  OTHER = 'OTHER',
  VISA = 'VISA',
}
export enum InstallmentEditScope {
  ONLY_THIS = 'ONLY_THIS',
  THIS_AND_NEXT = 'THIS_AND_NEXT',
}
export enum InvoicePaymentMethod {
  ACCOUNT = 'ACCOUNT',
  EXTERNAL = 'EXTERNAL',
}
export enum InvoiceStatus {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  PAID = 'PAID',
}
export enum RecurrenceFrequency {
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  WEEKLY = 'WEEKLY',
  YEARLY = 'YEARLY',
}
export enum RecurrenceStatus {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
}
export enum SystemCategoryKey {
  BALANCE_ADJUSTMENT = 'BALANCE_ADJUSTMENT',
  CARD_EARLY_PAYMENT = 'CARD_EARLY_PAYMENT',
  CARD_REFUND = 'CARD_REFUND',
  INSTALLMENT_PREPAYMENT_DISCOUNT = 'INSTALLMENT_PREPAYMENT_DISCOUNT',
  INVESTMENT_CONTRIBUTION = 'INVESTMENT_CONTRIBUTION',
  INVESTMENT_REDEMPTION = 'INVESTMENT_REDEMPTION',
  INVOICE_PAYMENT = 'INVOICE_PAYMENT',
  TRANSFER_FEE = 'TRANSFER_FEE',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
}
export enum TransactionSource {
  ACCOUNT = 'ACCOUNT',
  CARD = 'CARD',
}
export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}
