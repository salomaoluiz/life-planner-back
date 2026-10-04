import { z } from 'zod';

// Order matters: trim/lowercase must run before the email format check.
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
