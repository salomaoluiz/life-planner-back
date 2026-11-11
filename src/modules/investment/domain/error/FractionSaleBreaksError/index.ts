// Spec 108 FR 18: a write that would leave a sold fraction without a fraction.
export class FractionSaleBreaksError extends Error {
  constructor(readonly date: string) {
    super(`This change removes the fraction sold on ${date}. Delete the fraction sale first.`);
  }
}
