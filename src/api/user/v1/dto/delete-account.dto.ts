import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { emailSchema } from '@shared/infra/validation/email';

// Only `email`: unknown keys (`id`, `userId`...) are stripped and never used. The target is always the token user.
export const DeleteAccountApiSchema = z.object({ email: emailSchema });

export class DeleteAccountInput extends createZodDto(DeleteAccountApiSchema) {}
