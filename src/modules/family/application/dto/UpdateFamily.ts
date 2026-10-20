import { z } from 'zod';

import { FamilyNameSchema } from '@family/application/dto/CreateFamily';
import { FamilyStatus } from '@family/domain/enum';

export const UpdateFamilySchema = z.object({
  familyId: z.string().min(1),
  name: FamilyNameSchema.optional(),
  status: z.enum(FamilyStatus).optional(),
  userId: z.string().min(1),
});

export type UpdateFamilyInput = z.infer<typeof UpdateFamilySchema>;
