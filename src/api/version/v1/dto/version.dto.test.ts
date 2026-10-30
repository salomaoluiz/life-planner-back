import { VersionOutputSchema, VersionQuerySchema } from './version.dto';
import { mocks } from './version.dto.mocks';

describe('VersionOutputSchema', () => {
  it('SHOULD accept the documented response shape', () => {
    expect(VersionOutputSchema.parse(mocks.versionOutput)).toEqual(mocks.versionOutput);
  });

  it('SHOULD accept the "check unavailable" response', () => {
    const unavailable = {
      ...mocks.versionOutput,
      api: {
        ...mocks.versionOutput.api,
        latest: null,
        latestUrl: null,
        releases: [],
        updateAvailable: false,
      },
      checkedAt: null,
    };

    expect(VersionOutputSchema.safeParse(unavailable).success).toBe(true);
  });

  it('SHOULD reject an unknown environment', () => {
    expect(
      VersionOutputSchema.safeParse({ ...mocks.versionOutput, environment: 'QA' }).success,
    ).toBe(false);
  });
});

describe('VersionQuerySchema', () => {
  it.each([{}, { refresh: 'true' }, { refresh: 'false' }])('SHOULD accept %j', (query) => {
    expect(VersionQuerySchema.safeParse(query).success).toBe(true);
  });

  it('SHOULD reject refresh=maybe', () => {
    expect(VersionQuerySchema.safeParse({ refresh: 'maybe' }).success).toBe(false);
  });
});
