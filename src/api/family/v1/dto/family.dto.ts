import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const FamilyNameApiSchema = z.string().trim().min(1).max(50);

export const CreateFamilyApiSchema = z.object({ name: FamilyNameApiSchema });
export const UpdateFamilyApiSchema = z.object({ name: FamilyNameApiSchema });

export const FamilyApiSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  name: z.string(),
  ownerId: z.uuid(),
  updatedAt: z.iso.datetime(),
});

export class CreateFamilyInput extends createZodDto(CreateFamilyApiSchema) {}
export class FamilyOutput extends createZodDto(FamilyApiSchema) {}
export class UpdateFamilyInput extends createZodDto(UpdateFamilyApiSchema) {}
