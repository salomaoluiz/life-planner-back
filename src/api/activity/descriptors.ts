import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityGroupKind } from '@activity/domain/enum';
import { ActivityContext, ActivityDescriptor } from '@api/activity/ActivityRecorder';

// Helpers the controllers use to describe what a write route records (spec 127).

// `a.b.c` of the response body (undefined while the "before" is read).
export function fromResponse(path: string): (context: ActivityContext) => string | undefined {
  return (context) => {
    let value: unknown = context.response;

    for (const key of path.split('.')) {
      value = (value as Record<string, unknown> | undefined)?.[key];
    }

    return typeof value === 'string' ? value : undefined;
  };
}

// An id the route carries in its path (`:earlyPaymentId`), falling back to the response `id` on create.
export function fromParam(name: string): (context: ActivityContext) => string | undefined {
  return (context) => context.params[name];
}

// The `scope` of a series route: query on delete, body on update.
export function scopeOf(context: ActivityContext): string | undefined {
  const body = context.body as { scope?: unknown } | undefined;
  const scope = body?.scope ?? context.query.scope;

  return typeof scope === 'string' ? scope : undefined;
}

// FR 3: a scope THIS_AND_NEXT or ALL on a row of a series or an installment plan edits or removes several rows, so
// the request is one batch entry listing the rows that changed. ONLY_THIS (or no scope) stays a single entry.
export function seriesGroup(
  context: ActivityContext,
  before: ActivitySnapshot | null,
): ReturnType<NonNullable<ActivityDescriptor['group']>> {
  const scope = scopeOf(context);

  if (scope === undefined || scope === 'ONLY_THIS') {
    return undefined;
  }

  const recurrenceId = before?.refs?.recurrenceId;
  const planId = before?.refs?.installmentPlanId;

  if (recurrenceId) {
    return { id: recurrenceId, kind: ActivityGroupKind.RECURRENCE_ROWS };
  }

  return planId ? { id: planId, kind: ActivityGroupKind.INSTALLMENT_PLAN_ROWS } : undefined;
}

// A request on a series itself (`:id` is the series): scope ALL / THIS_AND_NEXT, or a delete, lists its rows.
export function wholeGroup(
  kind: ActivityGroupKind,
  idOf: (context: ActivityContext) => string | undefined,
): NonNullable<ActivityDescriptor['group']> {
  return (context) => ({ id: idOf(context), kind });
}

// `:id` of the route is the series and the scope says it affects its rows (delete of an occurrence).
export function seriesScopeGroup(
  kind: ActivityGroupKind,
): NonNullable<ActivityDescriptor['group']> {
  return (context) => {
    const scope = scopeOf(context);

    return scope === undefined || scope === 'ONLY_THIS'
      ? undefined
      : { id: context.params.id, kind };
  };
}

// `cardId:YYYY-MM` of an invoice route (the reader finds the payment by it).
export function invoiceKey(context: ActivityContext): string {
  return `${context.params.id}:${context.params.month}`;
}

// `plan:<planId>` of a prepayment route.
export function planKey(context: ActivityContext): string {
  return `plan:${context.params.id}`;
}

// A CSV import: `ownerType|ownerId` of the request (a family or the user).
export function importOwnerKey(context: ActivityContext): string {
  const body = context.body as { owner?: string; ownerId?: string };

  return body.owner === 'FAMILY' ? `FAMILY|${body.ownerId}` : `USER|${context.userId}`;
}

// The rows the import created, found by their stamp: read before (with the same window) and after the request, so a
// clock skew between the app and the database cancels out in the diff.
export function importGroup(
  context: ActivityContext,
): ReturnType<NonNullable<ActivityDescriptor['group']>> {
  const since = new Date(context.startedAt.getTime() - 10_000).toISOString();

  return { id: `${importOwnerKey(context)}|${since}`, kind: ActivityGroupKind.CREATED_SINCE };
}

// An income of a series edited or removed with a scope beyond this one lists the incomes of the series (FR 3).
export function incomeSeriesGroup(
  context: ActivityContext,
  before: ActivitySnapshot | null,
): ReturnType<NonNullable<ActivityDescriptor['group']>> {
  const scope = scopeOf(context);
  const seriesId = before?.refs?.seriesId;

  if (scope === undefined || scope === 'ONLY_THIS' || !seriesId) {
    return undefined;
  }

  return { id: seriesId, kind: ActivityGroupKind.INCOME_SERIES_ROWS };
}

// `assetId:YYYY-MM-DD` of a valuation route.
export function valuationKey(context: ActivityContext): string {
  return `${context.params.id}:${context.params.date}`;
}

// `rate:<id>` / `adjustment:<id>` find the fixed-income title of that rate or adjustment; once the "before" is known the
// title id is used (the row itself may be gone after a delete).
export function adjustmentKey(context: ActivityContext, before: ActivitySnapshot | null): string {
  return before?.entityId ?? `adjustment:${context.params.id}`;
}
export function rateKey(context: ActivityContext, before: ActivitySnapshot | null): string {
  return before?.entityId ?? `rate:${context.params.id}`;
}

// The finance rows a stock purchase close posted (a split, or a single transaction): found from the close response.
export function purchasePostingGroup(
  context: ActivityContext,
): ReturnType<NonNullable<ActivityDescriptor['group']>> {
  const result = context.response as
    | { splitId?: null | string; transactionId?: null | string }
    | undefined;

  if (result?.splitId) {
    return { id: result.splitId, kind: ActivityGroupKind.SPLIT_ROWS };
  }

  return { id: result?.transactionId ?? undefined, kind: ActivityGroupKind.TRANSACTION_IDS };
}
