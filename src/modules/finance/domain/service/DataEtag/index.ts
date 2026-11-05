import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

// Spec 092: the ETag of a finance GET is built from what the answer depends on, before any work is done:
// the caller, the route and its query, the owners read with their data versions, and the calendar day.
// Nothing readable travels in it: only opaque hashes and integers.
export interface DataEtagInput {
  // `YYYY-MM-DD` (UTC): a new day changes the ETag of every route that depends on "today".
  day: string;
  owners: OwnerAccess[];
  // Request path without the query string.
  path: string;
  // Raw query string (without `?`).
  query: string;
  userId: string;
  // Same order as `owners`; an owner that was never written has version 0.
  versions: number[];
}

// 53-bit string hash (cyrb53): enough for an opaque validator, pure TypeScript for the domain.
export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// The query parameters in a stable order, so `?a=1&b=2` and `?b=2&a=1` share one ETag.
export function buildDataEtag(input: DataEtagInput): string {
  const routeHash = hashText(`${input.userId}|${input.path}|${ownersSignature(input.owners)}`);
  const queryHash = hashText(normalizeQuery(input.query));
  const versions = input.versions.join('-');

  return `W/"${routeHash}.${versions}.${queryHash}.${input.day}"`;
}
export function ownersSignature(owners: OwnerAccess[]): string {
  return owners
    .map((access) => `${access.owner}:${access.ownerId}:${access.archived ? 'a' : 'w'}`)
    .sort()
    .join(',');
}

function normalizeQuery(query: string): string {
  return query
    .split('&')
    .filter((part) => part !== '')
    .sort()
    .join('&');
}
function stripWeak(value: string): string {
  return value.trim().replace(/^W\//, '');
}

// `If-None-Match` may list several validators or `*`; weak comparison (RFC 9110 §8.8.3.2).
export function matchesEtag(header: string | undefined, etag: string): boolean {
  if (!header) {
    return false;
  }

  const wanted = stripWeak(etag);

  return header
    .split(',')
    .some((candidate) => candidate.trim() === '*' || stripWeak(candidate) === wanted);
}
