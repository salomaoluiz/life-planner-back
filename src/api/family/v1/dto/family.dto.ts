import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { FamilyStatus } from '@family/domain/enum';
const FamilyNameApiSchema = z.string().trim().min(1).max(50);

export const CreateFamilyApiSchema = z.object({ name: FamilyNameApiSchema });
// A request either renames or changes the status, never both (keeps the read-only rule simple).
export const UpdateFamilyApiSchema = z
  .object({ name: FamilyNameApiSchema.optional(), status: z.enum(FamilyStatus).optional() })
  .refine((value) => (value.name === undefined) !== (value.status === undefined), {
    message: 'Send either name or status',
  });

export const FamilyApiSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  name: z.string(),
  ownerId: z.uuid(),
  status: z.enum(FamilyStatus),
  updatedAt: z.iso.datetime(),
});

export class CreateFamilyInput extends createZodDto(CreateFamilyApiSchema) {}
export class FamilyOutput extends createZodDto(FamilyApiSchema) {}
export class UpdateFamilyInput extends createZodDto(UpdateFamilyApiSchema) {}
