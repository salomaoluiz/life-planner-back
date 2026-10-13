import { z } from 'zod';

export const FindUsersByIdsSchema = z.object({
  ids: z.array(z.string().min(1)),
});

export type FindUsersByIdsInput = z.infer<typeof FindUsersByIdsSchema>;
export type FindUsersByIdsOutput = {
  email: string;
  id: string;
  name: string;
  photoUrl?: string;
}[];
