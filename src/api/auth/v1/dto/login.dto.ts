import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { emailSchema } from '@shared/infra/validation/email';

export const LoginWithEmailApiSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export type LoginWithEmailApiOutput = {
  token: string;
};

export class LoginWithEmailApiInput extends createZodDto(LoginWithEmailApiSchema) {}
