import { CaptureContext } from '@shared/infra/monitoring';

export interface RequestLike {
  method?: string;
  params?: Record<string, string | undefined>;
  query?: Record<string, unknown>;
  route?: { path?: string };
  user?: { id?: string };
}

// Spec 106: the tags that make an API issue searchable. Never the URL (it may carry ids of other users or `q`).
export function buildCaptureContext(
  request: RequestLike,
  status: number,
  controller?: string,
): CaptureContext {
  const tags: Record<string, string> = {
    method: request.method ?? 'UNKNOWN',
    route: request.route?.path ?? 'unknown',
    status_code: String(status),
    ...(controller ? { module: controller } : {}),
    ...ownerTags(request),
  };

  return { tags, userId: request.user?.id };
}

// Same tag names as the web: `owner_type` USER | FAMILY | ALL and `family_id` for a family.
function ownerTags(request: RequestLike): Record<string, string> {
  const familyId = request.params?.familyId;

  if (familyId) {
    return { family_id: familyId, owner_type: 'FAMILY' };
  }

  const raw = request.query?.ownerId;
  const ids = [raw ?? []].flat().filter((id): id is string => typeof id === 'string');

  if (ids.length > 1) {
    return { owner_type: 'ALL' };
  }

  if (ids.length === 1) {
    return ids[0] === request.user?.id
      ? { owner_type: 'USER' }
      : { family_id: ids[0], owner_type: 'FAMILY' };
  }

  return {};
}
