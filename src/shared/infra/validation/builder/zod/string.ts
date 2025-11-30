import { z } from 'zod';

import { createValidator, Validator } from './base';

const ValidateString = {
  email: () => createValidator<string>((v) => z.email().safeParse(v)),
  min: (minLength: number): Validator<string> =>
    createValidator<string>((v) => z.string().min(minLength).safeParse(v)),
  optional: () => createValidator<string | undefined>((v) => z.string().optional().safeParse(v)),
  required: () => createValidator<string>((v) => z.string().safeParse(v)),
  uuid: () => createValidator<string>((v) => z.uuid().safeParse(v)),
};

export default ValidateString;
