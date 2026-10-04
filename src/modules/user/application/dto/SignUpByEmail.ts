import { z } from 'zod';

import { emailSchema } from '@shared/infra/validation/email';

export const SignUpByEmailSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(72),
  photoURL: z.url().optional(),
});

export type SignUpByEmailInput = z.infer<typeof SignUpByEmailSchema>;
export type SignUpByEmailOutput = {
  id: string;
};
