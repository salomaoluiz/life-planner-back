import { z } from 'zod';

export const GetCategoryIconsSchema = z.object({
  limit: z.number().int().min(1).max(200).default(60),
  q: z.string().max(100).optional(),
});

export type GetCategoryIconsInput = z.input<typeof GetCategoryIconsSchema>;
