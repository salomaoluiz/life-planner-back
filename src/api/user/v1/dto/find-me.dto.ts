import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { FindUserByIdDtoSchema } from '@api/user/v1/dto/find-user-by-id.dto';
import { FamilyStatus } from '@family/domain/enum';

// Spec 074: the owners of the app (personal + families) come from this single call.
export const FindMeDtoSchema = FindUserByIdDtoSchema.extend({
  families: z.array(z.object({ id: z.string(), name: z.string(), status: z.enum(FamilyStatus) })),
});

export class FindMeOutput extends createZodDto(FindMeDtoSchema) {}
