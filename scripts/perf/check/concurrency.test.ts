import { join } from 'node:path';

import { loadRegistry } from '../registry';
import { loadConcurrency } from './concurrency';

const ROOT = join(__dirname, '../../../perf');

describe('loadConcurrency', () => {
  it('SHOULD load the finance scenario', () => {
    const scenarios = loadConcurrency(join(ROOT, 'concurrency.json'));
    expect(scenarios.finance.calls).toHaveLength(4);
    expect(scenarios.finance.repeat).toBe(3);
  });

  it('SHOULD throw WHEN the file is missing', () => {
    expect(() => loadConcurrency('/nope/concurrency.json')).toThrow(
      'perf concurrency: cannot read',
    );
  });

  it('SHOULD only reference keys that exist in the registry', () => {
    const registry = loadRegistry(join(ROOT, 'budgets'));
    const scenarios = loadConcurrency(join(ROOT, 'concurrency.json'));
    for (const [module, scenario] of Object.entries(scenarios)) {
      for (const call of scenario.calls) {
        expect(Object.keys(registry[module as keyof typeof registry])).toContain(call);
      }
    }
  });
});
