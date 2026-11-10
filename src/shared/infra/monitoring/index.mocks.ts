import { MonitoringConfig } from './types';

const config: MonitoringConfig = {
  dsn: 'https://public@example.com/1',
  enabled: true,
  environment: 'test',
  release: 'life-planner-back@1.0.0',
  tracesSampleRate: 0.1,
};

const mocks = { config };

export { mocks };
