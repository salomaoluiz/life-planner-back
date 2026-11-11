import * as Sentry from '@sentry/nestjs';

import { scrubEvent } from './scrub';
import { CaptureContext, MonitoringConfig } from './types';

// The only file of the API that imports the Sentry SDK (spec 106).
// `sendDefaultPii` is read by the SDK at runtime but is not in the 11.x option types.
interface FatalHandlerOptions {
  exit: (code: number) => void;
  log: (error: unknown) => void;
  target: Pick<NodeJS.Process, 'on'>;
}
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

// Last safety net (spec 106): an error that escapes every Nest filter (e.g. one thrown inside a filter) is sent,
// flushed and logged before the process ends. Node would end it anyway; this only makes sure it is reported first.
function registerFatalHandlers({ exit, log, target }: FatalHandlerOptions): void {
  (['uncaughtException', 'unhandledRejection'] as const).forEach((phase) => {
    target.on(phase, (error: unknown) => {
      captureException(error, { tags: { phase } });
      void flushMonitoring()
        .catch(() => undefined)
        .then(() => {
          log(error);
          exit(1);
        });
    });
  });
}

export {
  buildInitOptions,
  captureException,
  flushMonitoring,
  initMonitoring,
  registerFatalHandlers,
};
export type { CaptureContext, MonitoringConfig };
