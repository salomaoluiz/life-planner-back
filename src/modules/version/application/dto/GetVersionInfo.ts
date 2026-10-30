import { z } from 'zod';

export const GetVersionInfoSchema = z.object({ refresh: z.boolean().default(false) });

export type GetVersionInfoInput = z.input<typeof GetVersionInfoSchema>;
