import { z } from 'zod';

import { FamilyNameSchema } from '@family/application/dto/CreateFamily';

export const UpdateFamilySchema = z.object({
  familyId: z.string().min(1),
  name: FamilyNameSchema,
  userId: z.string().min(1),
});

export type UpdateFamilyInput = z.infer<typeof UpdateFamilySchema>;
