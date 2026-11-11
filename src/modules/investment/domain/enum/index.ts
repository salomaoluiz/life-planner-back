export enum InvestmentAssetClass {
  BR_REIT = 'BR_REIT',
  BR_STOCK = 'BR_STOCK',
  FIXED_INCOME = 'FIXED_INCOME',
  FOREIGN_STOCK = 'FOREIGN_STOCK',
  PRIVATE = 'PRIVATE',
}
export enum InvestmentAssetStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}
export enum InvestmentCorporateEventType {
  BONUS = 'BONUS',
  REVERSE_SPLIT = 'REVERSE_SPLIT',
  SPLIT = 'SPLIT',
}
export enum InvestmentFeeKind {
  BROKERAGE = 'BROKERAGE',
  EXCHANGE_FEES = 'EXCHANGE_FEES',
  FX_IOF = 'FX_IOF',
  INCOME_TAX = 'INCOME_TAX',
  IOF = 'IOF',
  OTHER = 'OTHER',
}
export enum InvestmentIncomeType {
  DIVIDEND = 'DIVIDEND',
  INTEREST = 'INTEREST',
  JCP = 'JCP',
  OTHER = 'OTHER',
  YIELD = 'YIELD',
}
export enum InvestmentOperationType {
  BONUS = 'BONUS',
  BUY = 'BUY',
  REVERSE_SPLIT = 'REVERSE_SPLIT',
  SELL = 'SELL',
  SPLIT = 'SPLIT',
}
export enum InvestmentSuggestionStatus {
  APPROVED = 'APPROVED',
  DISMISSED = 'DISMISSED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
}
export enum InvestmentValuationSource {
  MANUAL = 'MANUAL',
}

// Classes whose ticker is required (spec 102 FR 3).
export const TICKER_REQUIRED_CLASSES: InvestmentAssetClass[] = [
  InvestmentAssetClass.BR_REIT,
  InvestmentAssetClass.BR_STOCK,
  InvestmentAssetClass.FOREIGN_STOCK,
];
export enum InvestmentFixedIncomeLiquidity {
  AT_MATURITY = 'AT_MATURITY',
  DAILY = 'DAILY',
  GRACE_PERIOD = 'GRACE_PERIOD',
}
export enum InvestmentFixedIncomeProduct {
  CDB = 'CDB',
  CRA = 'CRA',
  CRI = 'CRI',
  DEBENTURE = 'DEBENTURE',
  INCENTIVIZED_DEBENTURE = 'INCENTIVIZED_DEBENTURE',
  LCA = 'LCA',
  LCI = 'LCI',
  OTHER = 'OTHER',
  TREASURY = 'TREASURY',
}
export enum InvestmentFixedIncomeRateMode {
  CDI_PERCENT = 'CDI_PERCENT',
  IPCA_PLUS = 'IPCA_PLUS',
  PREFIXED = 'PREFIXED',
}
export enum InvestmentFixedIncomeRedemptionKind {
  PARTIAL = 'PARTIAL',
  TOTAL = 'TOTAL',
}

// Spec 108 FR 1: operations that change the position without moving money.
export function isEventType(type: InvestmentOperationType): boolean {
  return (
    type === InvestmentOperationType.SPLIT ||
    type === InvestmentOperationType.REVERSE_SPLIT ||
    type === InvestmentOperationType.BONUS
  );
}
