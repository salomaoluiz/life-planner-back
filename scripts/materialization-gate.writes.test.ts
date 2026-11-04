import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Spec 081 §11: a write path that forgets to invalidate the gate shows missing occurrences for up to the TTL.
// Every use case that creates, changes or ends a recurrence series (or the rows it generates) is listed here.
const WRITE_USE_CASES = [
  'CreateRecurrenceUseCase',
  'DeleteFinanceDataByOwnerUseCase',
  'DeleteOccurrenceUseCase',
  'DeleteRecurrenceUseCase',
  'DeleteTransactionUseCase',
  'EndRecurrencesBySourceUseCase',
  'MaterializeOccurrenceUseCase',
  'SplitRecurrenceUseCase',
  'UpdateRecurrenceUseCase',
];

const WRITE_CALLS = [
  'recurrenceRepository.applyChange(',
  'recurrenceRepository.create(',
  'recurrenceRepository.createOccurrence(',
  'recurrenceRepository.removeFrom(',
  'recurrenceRepository.skipNumber(',
];

const useCaseDir = join(__dirname, '..', 'src', 'modules', 'finance', 'application', 'use-case');

describe('recurrence write use cases (spec 081)', () => {
  it.each(WRITE_USE_CASES)('SHOULD invalidate the gate in %s', (name) => {
    const source = readFileSync(join(useCaseDir, name, 'index.ts'), 'utf8');

    expect(source).toContain('materializationGate.invalidate(');
  });

  it('SHOULD list every use case that writes recurrences through the repository', () => {
    const writers = readdirSync(useCaseDir).filter((name) => {
      const source = readFileSync(join(useCaseDir, name, 'index.ts'), 'utf8');

      return WRITE_CALLS.some((call) => source.includes(call));
    });

    expect(writers.filter((name) => !WRITE_USE_CASES.includes(name))).toEqual([]);
  });
});
