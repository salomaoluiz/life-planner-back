export type ValidationErrorDetail = {
  code: string;
  expected: unknown;
  message: string;
};

export class ValidationError extends Error {
  public readonly details: ValidationErrorDetail[];

  constructor(details: ValidationErrorDetail[]) {
    super('Validation Failed');
    this.name = 'ValidationError';
    this.details = details;
  }
}
