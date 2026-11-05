import { z } from 'zod';

export const GetAccountFavoriteSchema = z.object({ userId: z.string().min(1) });

export type GetAccountFavoriteInput = z.input<typeof GetAccountFavoriteSchema>;
