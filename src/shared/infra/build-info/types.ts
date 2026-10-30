export interface BuildInfo {
  builtAt: null | string;
  releasedAt: null | string;
  version: string;
}
export interface IBuildInfo {
  read(): BuildInfo;
}
