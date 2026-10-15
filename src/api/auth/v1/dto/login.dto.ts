import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { emailSchema } from '@shared/infra/validation/email';

export const LoginWithEmailApiSchema = z.object({
  deviceName: z.string().trim().max(100).optional(),
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export type LoginWithEmailApiOutput = {
  refreshToken: string;
  refreshTokenExpiresIn: number;
  token: string;
};

export class LoginWithEmailApiInput extends createZodDto(LoginWithEmailApiSchema) {}
