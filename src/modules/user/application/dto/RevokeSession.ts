import { z } from 'zod';

export const RevokeSessionSchema = z.object({ refreshToken: z.string().min(1).max(512) });

export type RevokeSessionInput = z.infer<typeof RevokeSessionSchema>;
