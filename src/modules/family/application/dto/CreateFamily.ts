import { z } from 'zod';

export const FamilyNameSchema = z.string().trim().min(1).max(50);

export const CreateFamilySchema = z.object({
  name: FamilyNameSchema,
  ownerEmail: z.string().min(1),
  ownerId: z.string().min(1),
});

export type CreateFamilyInput = z.infer<typeof CreateFamilySchema>;
