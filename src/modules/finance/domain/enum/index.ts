export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
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
export enum SystemCategoryKey {
  BALANCE_ADJUSTMENT = 'BALANCE_ADJUSTMENT',
  CARD_EARLY_PAYMENT = 'CARD_EARLY_PAYMENT',
  CARD_REFUND = 'CARD_REFUND',
  INSTALLMENT_PREPAYMENT_DISCOUNT = 'INSTALLMENT_PREPAYMENT_DISCOUNT',
  INVOICE_PAYMENT = 'INVOICE_PAYMENT',
}
export enum TransactionSource {
  ACCOUNT = 'ACCOUNT',
  CARD = 'CARD',
}
export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}
