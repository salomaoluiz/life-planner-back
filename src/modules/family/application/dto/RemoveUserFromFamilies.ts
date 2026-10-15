import { z } from 'zod';

import { emailSchema } from '@shared/infra/validation/email';

export const RemoveUserFromFamiliesSchema = z.object({ email: emailSchema, userId: z.uuid() });
export type RemoveUserFromFamiliesInput = z.input<typeof RemoveUserFromFamiliesSchema>;
export type RemoveUserFromFamiliesOutput = { families: number; memberships: number };
