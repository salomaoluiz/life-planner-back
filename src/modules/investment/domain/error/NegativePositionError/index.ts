// Spec 102 FR 17: the first operation where the running quantity goes below zero.
export class NegativePositionError extends Error {
  constructor(
    readonly date: string,
    readonly operationId: string,
  ) {
    super(`This change would make the position negative on ${date}`);
  }
}
