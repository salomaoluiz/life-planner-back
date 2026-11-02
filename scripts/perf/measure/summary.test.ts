import { renderSummary } from './summary';

const ok = { budget: 5, key: 'GET /a', measured: 4, module: 'stock', status: 'ok' } as const;

function lastLine(text: string): string {
  const lines = text.trim().split('\n');

  return lines[lines.length - 1];
}

describe('renderSummary', () => {
  it('SHOULD end with PERF PASSED WHEN every measured row is ok', () => {
    const text = renderSummary([ok, { ...ok, key: 'GET /b', measured: 5 }]);

    expect(lastLine(text)).toBe('PERF PASSED: 2/2');
    expect(text).toContain('stock | GET /a | 5 | 4 | ok');
  });

  it('SHOULD list the failures WHEN a row exceeds its budget', () => {
    const text = renderSummary([ok, { ...ok, key: 'GET /b', measured: 9, status: 'fail' }]);

    expect(text).toContain('stock | GET /b | 5 | 9 | FAIL');
    expect(text).toContain('PERF FAILED: 1 of 2');
    expect(lastLine(text)).toBe('- GET /b');
  });

  it('SHOULD not count skipped rows', () => {
    const text = renderSummary([ok, { ...ok, key: 'POST /c', measured: 0, status: 'skipped' }]);

    expect(text).toContain('stock | POST /c | 5 | - | skipped');
    expect(text).toContain('PERF PASSED: 1/1');
  });
});
