import { createHash, randomBytes } from 'crypto';

const TOKEN_BYTES = 32;

// 32 bytes encode to exactly 43 base64url characters.
export const TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
