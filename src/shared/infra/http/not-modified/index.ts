import { HttpException, HttpStatus } from '@nestjs/common';

// Spec 092: thrown by the ETag guard when `If-None-Match` still matches; the exception filter answers it with an
// empty 304 (the guard has already set the validators), without logging it as an error.
export class NotModifiedException extends HttpException {
  constructor() {
    super('Not Modified', HttpStatus.NOT_MODIFIED);
  }
}
