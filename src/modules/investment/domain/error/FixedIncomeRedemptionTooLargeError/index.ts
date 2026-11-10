// Spec 105 FR 21: a change that makes a partial redemption larger than the title.
export class FixedIncomeRedemptionTooLargeError extends Error {
  constructor(
    readonly date: string,
    readonly operationId: string,
  ) {
    super(`This change makes the redemption of ${date} larger than the title`);
  }
}
