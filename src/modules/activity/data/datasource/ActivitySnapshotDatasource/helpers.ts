import { ActivityOwnerRef, ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityModule } from '@activity/domain/enum';
import { PrismaClient } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type SnapshotReader = (client: PrismaClient, id: string) => Promise<ActivitySnapshot | null>;

export const FINANCE = [ActivityModule.FINANCE];
export const INVESTMENT = [ActivityModule.INVESTMENT];

export function day(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

// Money columns hold positive cents; the sign of an entry follows the type (expense negative).
export function names(...values: (null | string | undefined)[]): string[] {
  return values.filter((value): value is string => value !== null && value !== undefined);
}
export function signed(value: number, type: 'EXPENSE' | 'INCOME'): number {
  return type === 'EXPENSE' ? -value : value;
}

// Snapshot of the owner's name: the user's own name or the family's.
export async function ownerRef(
  client: PrismaClient,
  owner: 'FAMILY' | 'USER',
  ownerId: string,
): Promise<ActivityOwnerRef> {
  if (owner === 'FAMILY') {
    const family = await client.family.findUnique({
      select: { name: true },
      where: { id: ownerId },
    });

    return { ownerId, ownerName: family?.name ?? '', ownerType: OwnerType.FAMILY };
  }

  const user = await client.user.findUnique({ select: { name: true }, where: { id: ownerId } });

  return { ownerId, ownerName: user?.name ?? '', ownerType: OwnerType.USER };
}
