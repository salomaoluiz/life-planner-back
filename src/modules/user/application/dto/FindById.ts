import { z } from 'zod';

export const FindByIdSchema = z.object({
  id: z.uuid(),
});

export type FindByIdInput = z.infer<typeof FindByIdSchema>;
export type FindByIdOutput = {
  email: string;
  id: string;
  name: string;
  photoUrl?: string;
};
