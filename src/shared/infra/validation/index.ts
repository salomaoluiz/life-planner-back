import { validateSchema } from './builder/zod/base';
import ValidateNumber from './builder/zod/number';
import ValidateString from './builder/zod/string';

export const Validation = {
  schema: {
    number: ValidateNumber,
    string: ValidateString,
  },
  validate: validateSchema,
};
