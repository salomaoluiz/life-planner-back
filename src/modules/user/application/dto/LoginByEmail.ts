import { z } from 'zod';

export const LoginByEmailSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export type LoginByEmailInput = z.infer<typeof LoginByEmailSchema>;
export type LoginByEmailOutput = {
  token: string;
};
