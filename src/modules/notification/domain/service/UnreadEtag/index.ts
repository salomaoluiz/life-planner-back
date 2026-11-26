import { UnreadStats } from '@notification/domain/entity/NotificationEntity';

// Spec 124 section 7: the validator of `GET /notifications/unread-count` is built from what the count depends on
// (user, unread count, newest notice, latest read), so a 304 needs one indexed query and nothing else.
export function buildUnreadEtag(userId: string, stats: UnreadStats): string {
  const created = stats.lastCreatedAt?.getTime() ?? 0;
  const read = stats.lastReadAt?.getTime() ?? 0;

  return `"n-${userId.slice(0, 8)}-${stats.count}-${created}-${read}"`;
}

// `If-None-Match` may carry several validators (or `*`); weak prefixes are ignored.
export function matchesUnreadEtag(header: string | undefined, etag: string): boolean {
  if (!header) {
    return false;
  }

  return header
    .split(',')
    .some((candidate) => candidate.trim() === '*' || candidate.trim().replace(/^W\//, '') === etag);
}
