// Spec 108 FR 13: a corporate event dated where no shares are held.
export class NoPositionError extends Error {
  constructor(readonly date: string) {
    super(`There is no position on ${date}`);
  }
}
