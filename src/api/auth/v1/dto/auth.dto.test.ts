import { z } from 'zod';

import { LoginWithEmailApiSchema } from '@api/auth/v1/dto/login.dto';
import { SignUpWithEmailApiSchema } from '@api/auth/v1/dto/signup.dto';
import { LoginByEmailSchema } from '@user/application/dto/LoginByEmail';
import { SignUpByEmailSchema } from '@user/application/dto/SignUpByEmail';

const validSignUp = { email: 'test@example.com', name: 'Test User', password: 'password123' };

describe.each([
  ['API', SignUpWithEmailApiSchema],
  ['application', SignUpByEmailSchema],
])('GIVEN the %s signup schema', (_label, schema) => {
  it('SHOULD normalize email and trim name', () => {
    const result = schema.parse({ ...validSignUp, email: ' Test@Example.com ', name: ' Ana ' });

    expect(result.email).toBe('test@example.com');
    expect(result.name).toBe('Ana');
  });

  it.each([
    ['whitespace-only name', { name: '   ' }],
    ['101-char name', { name: 'a'.repeat(101) }],
    ['7-char password', { password: '1234567' }],
    ['73-char password', { password: 'a'.repeat(73) }],
    ['malformed email', { email: 'nope' }],
  ])('SHOULD reject %s', (_name, override) => {
    expect(schema.safeParse({ ...validSignUp, ...override }).success).toBe(false);
  });

  it.each([
    ['100-char name', { name: 'a'.repeat(100) }],
    ['8-char password', { password: '12345678' }],
    ['72-char password', { password: 'a'.repeat(72) }],
    ['optional photoURL', { photoURL: 'https://example.com/a.png' }],
  ])('SHOULD accept %s', (_name, override) => {
    expect(schema.safeParse({ ...validSignUp, ...override }).success).toBe(true);
  });
});

describe.each([
  ['API', LoginWithEmailApiSchema],
  ['application', LoginByEmailSchema],
])('GIVEN the %s login schema', (_label, schema) => {
  it('SHOULD normalize the email', () => {
    expect(schema.parse({ email: ' Test@Example.com ', password: 'x' }).email).toBe(
      'test@example.com',
    );
  });

  it('SHOULD accept any non-empty password up to 72 chars', () => {
    expect(schema.safeParse({ email: 'test@example.com', password: 'abc' }).success).toBe(true);
    expect(schema.safeParse({ email: 'test@example.com', password: 'a'.repeat(72) }).success).toBe(
      true,
    );
  });

  it.each(['', 'a'.repeat(73)])('SHOULD reject password %j', (password) => {
    expect(schema.safeParse({ email: 'test@example.com', password }).success).toBe(false);
  });
});

describe('GIVEN Swagger generation', () => {
  it('SHOULD be able to emit JSON Schema for the piped email field', () => {
    expect(() => z.toJSONSchema(SignUpWithEmailApiSchema, { io: 'input' })).not.toThrow();
    expect(() => z.toJSONSchema(LoginWithEmailApiSchema, { io: 'input' })).not.toThrow();
  });
});
