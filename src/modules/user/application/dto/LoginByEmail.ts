import { z } from 'zod';

import { emailSchema } from '@shared/infra/validation/email';

export const LoginByEmailSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export type LoginByEmailInput = z.infer<typeof LoginByEmailSchema>;
export type LoginByEmailOutput = {
  token: string;
};
