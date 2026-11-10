export interface CaptureContext {
  tags?: Record<string, string>;
  userId?: string;
}
export interface MonitoringConfig {
  dsn?: string;
  enabled: boolean;
  environment: string;
  release: string;
  tracesSampleRate: number;
}
