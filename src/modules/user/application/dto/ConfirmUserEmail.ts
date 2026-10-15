import { z } from 'zod';

import { emailSchema } from '@shared/infra/validation/email';

export const ConfirmUserEmailSchema = z.object({ email: emailSchema, id: z.uuid() });
export type ConfirmUserEmailInput = z.input<typeof ConfirmUserEmailSchema>;
export type ConfirmUserEmailOutput = { email: string };
