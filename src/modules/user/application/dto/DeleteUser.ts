import { z } from 'zod';

export const DeleteUserSchema = z.object({ id: z.uuid() });
export type DeleteUserInput = z.infer<typeof DeleteUserSchema>;
