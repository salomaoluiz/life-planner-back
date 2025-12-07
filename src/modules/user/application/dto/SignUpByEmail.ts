import { z } from 'zod';

export const SignUpByEmailSchema = z.object({
  email: z.email(),
  name: z.string(),
  password: z.string().min(6),
  photoURL: z.url().optional(),
});

export type SignUpByEmailInput = z.infer<typeof SignUpByEmailSchema>;
export type SignUpByEmailOutput = {
  id: string;
};
