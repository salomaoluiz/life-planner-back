export interface GithubRelease {
  body: string;
  publishedAt: string;
  tagName: string;
  url: string;
}
export interface IGithubReleases {
  // Published releases (no drafts or prereleases), newest first. Throws when GitHub fails.
  listReleases(repo: string): Promise<GithubRelease[]>;
}
