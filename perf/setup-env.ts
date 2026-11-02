// Runs before any module of the perf project is imported.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: the variables come from the shell.
}
process.env.PERF_COUNT_QUERIES = '1';
process.env.SWAGGER_ENABLED = 'false';
