import { emailSchema } from './email';

describe('GIVEN emailSchema', () => {
  it('SHOULD trim and lowercase WHEN the email has spaces and uppercase', () => {
    expect(emailSchema.parse('  Test@Example.com ')).toBe('test@example.com');
  });

  it.each(['', '   ', 'not-an-email', 'a@', '@b.com', `${'a'.repeat(250)}@b.co`])(
    'SHOULD reject %j',
    (value) => {
      expect(emailSchema.safeParse(value).success).toBe(false);
    },
  );

  it('SHOULD accept an email of exactly 254 chars', () => {
    const local = 'a'.repeat(64);
    const domain = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`;
    const email = `${local}@${domain}`;

    expect(email).toHaveLength(254);
    expect(emailSchema.safeParse(email).success).toBe(true);
  });

  it('SHOULD reject a non-string', () => {
    expect(emailSchema.safeParse(123).success).toBe(false);
    expect(emailSchema.safeParse(undefined).success).toBe(false);
  });
});
