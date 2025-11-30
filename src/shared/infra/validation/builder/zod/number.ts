import { z } from 'zod';

import { createValidator, Validator } from './base';

const ValidateNumber = {
  min: (minLength: number): Validator<number> =>
    createValidator<number>((v) => z.number().min(minLength).safeParse(v)),
  positive: () => createValidator<number>((v) => z.number().positive().safeParse(v)),
  required: () => createValidator<number>((v) => z.number().safeParse(v)),
};

export default ValidateNumber;
