// Spec 112 FR 5: the origin has operations after the record date.
export class ConversionLaterOperationsError extends Error {
  constructor(
    readonly ticker: null | string,
    readonly date: string,
    readonly operations: { date: string; id: string; type: string }[],
  ) {
    super(
      `${ticker ?? 'The asset'} has operations after ${date}. Delete them or pick another date.`,
    );
  }
}
