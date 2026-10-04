import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { emailSchema } from '@shared/infra/validation/email';

export const SignUpWithEmailApiSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(72),
  photoURL: z.url().optional(),
});

export type SignUpWithEmailApiOutput = void;

export class SignUpWithEmailApiInput extends createZodDto(SignUpWithEmailApiSchema) {}
