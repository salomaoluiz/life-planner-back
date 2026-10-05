import { z } from 'zod';

// `?ownerId=a` arrives as a string, `?ownerId=a&ownerId=b` as an array.
export const OwnerIdQuerySchema = z.union([z.uuid(), z.array(z.uuid())]).optional();

export function toOwnerIds(ownerId?: string | string[]): string[] | undefined {
  if (ownerId === undefined) {
    return undefined;
  }

  return Array.isArray(ownerId) ? ownerId : [ownerId];
}
