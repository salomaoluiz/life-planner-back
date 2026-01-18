import { z } from 'zod';

export const UpdateUserSchema = z.object({
  email: z.email().optional(),
  id: z.uuid(),
  name: z.string().min(1).max(100).optional(),
  photoUrl: z.url().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UpdateUserOutput = {
  email: string;
  id: string;
  name: string;
  photoUrl?: string;
};
