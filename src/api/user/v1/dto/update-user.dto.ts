import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateUserInputSchema = z.object({
  email: z.email().optional(),
  name: z.string().min(1).max(100).optional(),
  photoUrl: z.url().optional(),
});

const UpdateUserSchema = z.object({
  email: z.email().optional(),
  id: z.string(),
  name: z.string().optional(),
  photoUrl: z.url().optional(),
});

export class UpdateUserInput extends createZodDto(UpdateUserInputSchema) {
  @ApiProperty({ example: 'https://example.com/photo.jpg', required: false })
  photoUrl?: string;
}
export class UpdateUserOutput extends createZodDto(UpdateUserSchema) {}
