import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SignUpWithEmailApiSchema = z.object({
  email: z.email(),
  name: z.string(),
  password: z.string().min(6),
  photoURL: z.url().optional(),
});

export type SignUpWithEmailApiOutput = void;

export class SignUpWithEmailApiInput extends createZodDto(SignUpWithEmailApiSchema) {}
