export interface SemVerParts {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)$/;

export const SemVer = {
  compare(a: string, b: string): number {
    const left = SemVer.parse(a);
    const right = SemVer.parse(b);

    if (!left || !right) {
      throw new Error('SemVer.compare received a value that is not x.y.z');
    }

    return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
  },

  // The highest valid tag, without the leading "v"; null when none is valid.
  highest(tags: string[]): null | string {
    const valid = tags.filter((tag) => SemVer.parse(tag)).map((tag) => tag.replace(/^v/, ''));

    return valid.length === 0 ? null : valid.reduce((a, b) => (SemVer.compare(a, b) >= 0 ? a : b));
  },
  isGreater(a: string, b: string): boolean {
    return SemVer.compare(a, b) > 0;
  },
  parse(tag: string): null | SemVerParts {
    const match = SEMVER_REGEX.exec(tag);

    return match
      ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
      : null;
  },
};
