export function missingCount(existing: number, wanted: number): number {
  return Math.max(0, wanted - existing);
}
