import { z } from 'zod';

import { LoginByEmailOutput } from '@user/application/dto/LoginByEmail';

export const RefreshSessionSchema = z.object({ refreshToken: z.string().min(1).max(512) });

export type RefreshSessionInput = z.infer<typeof RefreshSessionSchema>;
export type RefreshSessionOutput = LoginByEmailOutput;
