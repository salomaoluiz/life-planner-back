import { v4, v5 } from 'uuid';

export function uuidV4(): string {
  return v4();
}
export function uuidV5(value: string, namespace: string): string {
  return v5(value, namespace);
}
