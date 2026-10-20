import { OwnerType, Prisma } from '@db/client';

// Tags come back with the rows, in the stored order (spec 043 FR 8).
export const TAG_INCLUDE = {
  tags: {
    orderBy: { position: 'asc' },
    select: { tag: { select: { id: true, name: true } } },
  },
} as const;

// Resolves `names` in the owner and replaces the tags of every transaction matching `where` (one database
// transaction with the caller's write). Returns the ids it tagged.
export async function applyTagNames(
  tx: Prisma.TransactionClient,
  params: {
    names: string[];
    owner: OwnerType;
    ownerId: string;
    where: Prisma.FinancialTransactionWhereInput;
  },
): Promise<string[]> {
  const [tagIds, rows] = await Promise.all([
    resolveTagIds(tx, params),
    tx.financialTransaction.findMany({ select: { id: true }, where: params.where }),
  ]);

  if (rows.length > 0) {
    await setTransactionTags(
      tx,
      rows.map((row) => row.id),
      tagIds,
    );
  }

  return rows.map((row) => row.id);
}

// The tag ids of one transaction in the stored order (a plan recreate carries them over).
export async function tagIdsOfRow(
  tx: Prisma.TransactionClient,
  where: Prisma.FinancialTransactionWhereInput,
): Promise<string[]> {
  const row = await tx.financialTransaction.findFirst({
    orderBy: { installment_number: 'asc' },
    select: { tags: { orderBy: { position: 'asc' }, select: { tag_id: true } } },
    where,
  });

  return (row?.tags ?? []).map((link) => link.tag_id);
}

// The names of the tags of one transaction, in order (an owner change re-resolves them).
export type TagLinks = Prisma.FinancialTransactionTagGetPayload<{
  select: { tag: { select: { id: true; name: true } } };
}>[];

export async function tagNamesOfRow(
  tx: Prisma.TransactionClient,
  transactionId: string,
): Promise<string[]> {
  const links = await tx.financialTransactionTag.findMany({
    orderBy: { position: 'asc' },
    select: { tag: { select: { name: true } } },
    where: { transaction_id: transactionId },
  });

  return links.map((link) => link.tag.name);
}

// Unique names (ignoring case, first spelling and order win).
export function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();

  return names.filter((name) => {
    const key = name.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

// Spec 043 FR 8: reuses the tag usable in the owner (its own single-scope tag first), creates the missing ones as
// single-scope tags of that owner. Runs inside the caller's database transaction.
export async function resolveTagIds(
  tx: Prisma.TransactionClient,
  params: { names: string[]; owner: OwnerType; ownerId: string },
): Promise<string[]> {
  const names = uniqueNames(params.names);

  if (names.length === 0) {
    return [];
  }

  const usable = await tx.financialTag.findMany({
    orderBy: { all_scopes: 'asc' },
    select: { all_scopes: true, id: true, name: true },
    where: {
      OR: [
        { all_scopes: false, owner: params.owner, owner_id: params.ownerId },
        { all_scopes: true, scopes: { some: { owner: params.owner, owner_id: params.ownerId } } },
      ],
    },
  });
  const byName = new Map<string, string>();

  for (const tag of usable) {
    const key = tag.name.toLowerCase();

    if (!byName.has(key)) {
      byName.set(key, tag.id);
    }
  }

  const ids: string[] = [];

  for (const name of names) {
    const existing = byName.get(name.toLowerCase());

    if (existing) {
      ids.push(existing);
      continue;
    }

    const created = await tx.financialTag.create({
      data: { creator_id: params.ownerId, name, owner: params.owner, owner_id: params.ownerId },
      select: { id: true },
    });

    ids.push(created.id);
  }

  return ids;
}

// Replaces the tags of the given transactions with `tagIds` (position = index).
export async function setRecurrenceTags(
  tx: Prisma.TransactionClient,
  recurrenceId: string,
  tagIds: string[],
): Promise<void> {
  await tx.financialRecurrenceTag.deleteMany({ where: { recurrence_id: recurrenceId } });
  await tx.financialRecurrenceTag.createMany({
    data: tagIds.map((tag_id, position) => ({ position, recurrence_id: recurrenceId, tag_id })),
  });
}
export async function setTransactionTags(
  tx: Prisma.TransactionClient,
  transactionIds: string[],
  tagIds: string[],
): Promise<void> {
  await tx.financialTransactionTag.deleteMany({
    where: { transaction_id: { in: transactionIds } },
  });
  await tx.financialTransactionTag.createMany({
    data: transactionIds.flatMap((transaction_id) =>
      tagIds.map((tag_id, position) => ({ position, tag_id, transaction_id })),
    ),
  });
}

// Gives the occurrences of a series (those matching `where`, without tags yet) the tags of the series.
export async function copyRecurrenceTagsToRows(
  tx: Prisma.TransactionClient,
  recurrenceId: string,
  where: Prisma.FinancialTransactionWhereInput = {},
): Promise<void> {
  const [links, rows] = await Promise.all([
    tx.financialRecurrenceTag.findMany({ where: { recurrence_id: recurrenceId } }),
    tx.financialTransaction.findMany({
      select: { id: true },
      where: { ...where, recurrence_id: recurrenceId, tags: { none: {} } },
    }),
  ]);

  if (links.length === 0 || rows.length === 0) {
    return;
  }

  await tx.financialTransactionTag.createMany({
    data: rows.flatMap((row) =>
      links.map((link) => ({
        position: link.position,
        tag_id: link.tag_id,
        transaction_id: row.id,
      })),
    ),
    skipDuplicates: true,
  });
}

// Copies the tags of series `fromId` to series `toId` (a split keeps the tags unless new ones are given).
export async function copyRecurrenceTags(
  tx: Prisma.TransactionClient,
  fromId: string,
  toId: string,
): Promise<void> {
  const links = await tx.financialRecurrenceTag.findMany({ where: { recurrence_id: fromId } });

  await tx.financialRecurrenceTag.createMany({
    data: links.map((link) => ({
      position: link.position,
      recurrence_id: toId,
      tag_id: link.tag_id,
    })),
    skipDuplicates: true,
  });
}
export function toTagRefs(links: TagLinks | undefined) {
  return (links ?? []).map((link) => ({ id: link.tag.id, name: link.tag.name }));
}
