import { dedupeKeyOf, NotificationItemInput } from '@notification/domain/entity/NotificationItem';

// Spec 124 FR 14: the DUE_TODAY items whose key is not part of any notice the user already got on the local date
// (summary or urgent). Repeated keys inside the candidates count once.
export function selectUrgent(
  candidates: NotificationItemInput[],
  knownKeys: ReadonlySet<string>,
): NotificationItemInput[] {
  const seen = new Set(knownKeys);

  return candidates.filter((item) => {
    const key = dedupeKeyOf(item);

    if (item.state !== 'DUE_TODAY' || seen.has(key)) {
      return false;
    }
    seen.add(key);

    return true;
  });
}
