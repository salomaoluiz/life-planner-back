export enum AppEnvironment {
  DEVELOPMENT = 'DEVELOPMENT',
  PRODUCTION = 'PRODUCTION',
  STAGING = 'STAGING',
}
export enum ChangelogSectionType {
  ADDED = 'ADDED',
  CHANGED = 'CHANGED',
  FIXED = 'FIXED',
  REMOVED = 'REMOVED',
  SECURITY = 'SECURITY',
}

export interface ApiVersionInfo {
  builtAt: null | string;
  current: string;
  latest: null | string;
  latestUrl: null | string;
  releasedAt: null | string;
  releases: ReleaseNotes[];
  startedAt: string;
  updateAvailable: boolean;
}
export interface AppVersionInfo {
  latest: null | string;
  latestUrl: null | string;
  releases: ReleaseNotes[];
}
export interface ChangelogSection {
  items: string[];
  type: ChangelogSectionType;
}
export interface ReleaseNotes {
  publishedAt: string;
  sections: ChangelogSection[];
  url: string;
  version: string;
}
export interface VersionInfo {
  api: ApiVersionInfo;
  app: AppVersionInfo;
  checkedAt: null | string;
  environment: AppEnvironment;
}
