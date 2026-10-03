import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginWithEmailApiSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export type LoginWithEmailApiOutput = {
  token: string;
};

export class LoginWithEmailApiInput extends createZodDto(LoginWithEmailApiSchema) {}
