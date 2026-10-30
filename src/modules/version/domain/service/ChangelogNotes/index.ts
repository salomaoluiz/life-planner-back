import { ChangelogSection, ChangelogSectionType } from '@version/domain/entity/VersionInfo';

const MAX_ITEMS = 10;
const MAX_LENGTH = 300;

const HEADINGS: Record<string, ChangelogSectionType> = {
  added: ChangelogSectionType.ADDED,
  changed: ChangelogSectionType.CHANGED,
  fixed: ChangelogSectionType.FIXED,
  removed: ChangelogSectionType.REMOVED,
  security: ChangelogSectionType.SECURITY,
};

function toPlainText(line: string): string {
  return line
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .trim()
    .slice(0, MAX_LENGTH);
}

export const ChangelogNotes = {
  // Parses a release body (a CHANGELOG.md section) into its labelled bullet groups.
  parse(body: string): ChangelogSection[] {
    const sections = new Map<ChangelogSectionType, string[]>();
    let current: ChangelogSectionType | null = null;
    let sawHeading = false;
    const loose: string[] = [];

    for (const raw of body.split(/\r?\n/)) {
      const heading = /^###\s+(.+?)\s*$/.exec(raw);

      if (heading) {
        sawHeading = true;
        current = HEADINGS[heading[1].toLowerCase()] ?? ChangelogSectionType.CHANGED;
        continue;
      }

      const text = toPlainText(raw);

      if (!text) {
        continue;
      }

      if (current) {
        sections.set(current, [...(sections.get(current) ?? []), text]);
      } else {
        loose.push(text);
      }
    }

    if (!sawHeading) {
      return loose.length > 0
        ? [{ items: loose.slice(0, MAX_ITEMS), type: ChangelogSectionType.CHANGED }]
        : [];
    }

    return [...sections.entries()].map(([type, items]) => ({
      items: items.slice(0, MAX_ITEMS),
      type,
    }));
  },
};
