import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.email(),
  name: z.string(),
  photoURL: z.url(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type CreateUserOutput = {
  id: string;
};
