import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RefreshApiSchema = z.object({ refreshToken: z.string().min(1).max(512) });

export class RefreshApiInput extends createZodDto(RefreshApiSchema) {}
