// Spec 106: imported first in main.ts, as the Sentry SDK requires. Reads process.env directly because it runs
// before Nest builds the config.
import { BuildInfoReader } from '@shared/infra/build-info';
import { initMonitoring } from '@shared/infra/monitoring';

function emptyToUndefined(value?: string): string | undefined {
  return value === '' ? undefined : value;
}

const rate = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0');

initMonitoring({
  dsn: emptyToUndefined(process.env.SENTRY_DSN),
  enabled: process.env.SENTRY_ENABLED === 'true',
  environment:
    emptyToUndefined(process.env.SENTRY_ENVIRONMENT) ??
    emptyToUndefined(process.env.NODE_ENV) ??
    'development',
  release: `life-planner-back@${new BuildInfoReader().read().version}`,
  tracesSampleRate: Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 1) : 0,
});
