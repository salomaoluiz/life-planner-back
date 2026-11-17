// Spec 113: the three indexes the screens show, and the stored series behind them.
export enum MarketIndex {
  CDI = 'CDI',
  IPCA = 'IPCA',
  SELIC = 'SELIC',
}
export enum MarketIndexSeries {
  CDI_ANNUAL = 'CDI_ANNUAL',
  CDI_DAILY = 'CDI_DAILY',
  IPCA_12M = 'IPCA_12M',
  IPCA_EXPECTED_12M = 'IPCA_EXPECTED_12M',
  IPCA_MONTHLY = 'IPCA_MONTHLY',
  SELIC_DAILY = 'SELIC_DAILY',
  SELIC_TARGET = 'SELIC_TARGET',
}
