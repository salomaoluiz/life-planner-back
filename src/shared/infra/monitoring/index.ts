import * as Sentry from '@sentry/nestjs';

import { scrubEvent } from './scrub';
import { CaptureContext, MonitoringConfig } from './types';

// The only file of the API that imports the Sentry SDK (spec 106).
// `sendDefaultPii` is read by the SDK at runtime but is not in the 11.x option types.
type InitOptions = { sendDefaultPii: false } & Sentry.NodeOptions;

function buildInitOptions(config: MonitoringConfig): InitOptions {
  return {
    beforeBreadcrumb: (breadcrumb) =>
      scrubEvent({ breadcrumbs: [breadcrumb] }).breadcrumbs?.[0] as Sentry.Breadcrumb,
    beforeSend: (event) => scrubEvent(event),
    dsn: config.dsn,
    enabled: config.enabled && Boolean(config.dsn),
    environment: config.environment,
    release: config.release,
    sendDefaultPii: false,
    tracesSampleRate: config.tracesSampleRate,
  };
}
function captureException(error: unknown, context: CaptureContext = {}): void {
  Sentry.withScope((scope) => {
    if (context.tags) scope.setTags(context.tags);
    if (context.userId) scope.setUser({ id: context.userId });
    Sentry.captureException(error);
  });
}
async function flushMonitoring(timeoutMs = 2000): Promise<void> {
  await Sentry.flush(timeoutMs);
}
function initMonitoring(config: MonitoringConfig): void {
  Sentry.init(buildInitOptions(config));
}

export { buildInitOptions, captureException, flushMonitoring, initMonitoring };
export type { CaptureContext, MonitoringConfig };
