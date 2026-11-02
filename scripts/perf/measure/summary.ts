import type { PerfModule } from '../modules';

export interface SummaryRow {
  budget: number;
  key: string;
  measured: number;
  module: PerfModule;
  status: 'fail' | 'ok' | 'skipped';
}

export function renderSummary(rows: SummaryRow[]): string {
  const lines = rows.map((row) => {
    const measured = row.status === 'skipped' ? '-' : String(row.measured);
    const status = row.status === 'fail' ? 'FAIL' : row.status;

    return `${row.module} | ${row.key} | ${row.budget} | ${measured} | ${status}`;
  });
  const measuredRows = rows.filter((row) => row.status !== 'skipped');
  const failures = measuredRows.filter((row) => row.status === 'fail');
  const verdict =
    failures.length === 0
      ? [`PERF PASSED: ${measuredRows.length}/${measuredRows.length}`]
      : [
          `PERF FAILED: ${failures.length} of ${measuredRows.length}`,
          ...failures.map((row) => `- ${row.key}`),
        ];

  return `${[...lines, '', ...verdict].join('\n')}\n`;
}
