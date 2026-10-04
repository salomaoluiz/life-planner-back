import { buildCorsOptions } from './index';

type OriginFn = (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => void;

function check(options: ReturnType<typeof buildCorsOptions>, origin: string | undefined) {
  let allowed: boolean | undefined;
  (options!.origin as OriginFn)(origin, (_err, allow) => {
    allowed = allow;
  });
  return allowed;
}

describe('GIVEN buildCorsOptions', () => {
  it.each(['', '   ', ' , ,'])('SHOULD return undefined (CORS disabled) WHEN raw is %j', (raw) => {
    expect(buildCorsOptions(raw)).toBeUndefined();
  });

  it('SHOULD allow only the listed origins (trimmed, comma-separated)', () => {
    const options = buildCorsOptions('http://localhost:8081, https://app.example.com ');

    expect(check(options, 'http://localhost:8081')).toBe(true);
    expect(check(options, 'https://app.example.com')).toBe(true);
    expect(check(options, 'https://evil.example.com')).toBe(false);
  });

  it('SHOULD allow requests without Origin (native app, curl)', () => {
    expect(check(buildCorsOptions('http://localhost:8081'), undefined)).toBe(true);
  });

  it('SHOULD expose the spec methods/headers and no credentials', () => {
    const options = buildCorsOptions('http://localhost:8081')!;

    expect(options.methods).toEqual(['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']);
    expect(options.allowedHeaders).toEqual(['Authorization', 'Content-Type']);
    expect(options.credentials).toBe(false);
  });
});
