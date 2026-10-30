import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Spec 058 FR 13: `limit` is 1-200 (default 60); out of range is a 400.
export const CategoryIconsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(60),
  q: z.string().max(100).optional(),
});

export const CategoryIconApiSchema = z.object({
  common: z.boolean(),
  group: z.string(),
  labelEn: z.string(),
  labelPt: z.string(),
  name: z.string(),
});

export const CategoryIconsApiSchema = z.object({ items: z.array(CategoryIconApiSchema) });

export type CategoryIconsApiOutput = z.infer<typeof CategoryIconsApiSchema>;

export class CategoryIconsOutput extends createZodDto(CategoryIconsApiSchema) {}
