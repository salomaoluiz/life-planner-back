import { BadRequestException } from '@nestjs/common';

export type ValidationErrorDetail = {
  code: string;
  field: string;
  message: string;
};

export class ValidationError extends BadRequestException {
  public readonly details: ValidationErrorDetail[];

  constructor(details: ValidationErrorDetail[]) {
    super('Validation Failed');
    this.name = 'ValidationError';
    this.details = details;
  }
}
