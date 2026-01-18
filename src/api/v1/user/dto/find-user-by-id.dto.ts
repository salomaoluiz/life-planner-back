import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const FindUserByIdDtoSchema = z.object({
  email: z.email(),
  id: z.string(),
  name: z.string(),
  photoUrl: z.url().optional(),
});

export class FindUserByIdOutput extends createZodDto(FindUserByIdDtoSchema) {}
