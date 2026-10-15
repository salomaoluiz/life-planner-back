import { z } from 'zod';

import { emailSchema } from '@shared/infra/validation/email';

export const LoginByEmailSchema = z.object({
  deviceName: z.string().trim().max(100).optional(),
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export type LoginByEmailInput = z.infer<typeof LoginByEmailSchema>;
export type LoginByEmailOutput = {
  refreshToken: string;
  refreshTokenExpiresIn: number;
  token: string;
};
