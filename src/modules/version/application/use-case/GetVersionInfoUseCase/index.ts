import { Inject, Injectable } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { IBuildInfo } from '@shared/infra/build-info/types';
import { EnvService } from '@shared/infra/env/env.service';
import { GithubRelease, IGithubReleases } from '@shared/infra/github/types';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { validate } from '@shared/infra/validation';
import { GetVersionInfoInput, GetVersionInfoSchema } from '@version/application/dto/GetVersionInfo';
import { AppEnvironment, ReleaseNotes, VersionInfo } from '@version/domain/entity/VersionInfo';
import { ChangelogNotes } from '@version/domain/service/ChangelogNotes';
import { SemVer } from '@version/domain/service/SemVer';

const MAX_RELEASES = 10;
const FAILURE_TTL_MS = 60_000;
const REFRESH_MIN_AGE_MS = 60_000;

interface CacheEntry {
  at: number;
  releases: null | ReleaseNotes[];
}

const startedAt = new Date().toISOString();

@Injectable()
export class GetVersionInfoUseCase implements UseCaseWithParams<GetVersionInfoInput, VersionInfo> {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<CacheEntry>>();

  constructor(
    @Inject('IGithubReleases') private readonly github: IGithubReleases,
    @Inject('IBuildInfo') private readonly buildInfo: IBuildInfo,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly env: EnvService,
  ) {}

  async execute(params: GetVersionInfoInput): Promise<VersionInfo> {
    const { refresh } = validate(GetVersionInfoSchema, params);
    const local = this.buildInfo.read();
    const [api, app] = await Promise.all([
      this.load(this.env.versionRepoApi, refresh),
      this.load(this.env.versionRepoApp, refresh),
    ]);
    const apiReleases = api?.releases ?? [];
    const appReleases = app?.releases ?? [];
    const apiLatest = apiReleases[0] ?? null;
    const appLatest = appReleases[0] ?? null;
    const fetchedAt = [api, app]
      .filter((entry): entry is CacheEntry => entry !== null && entry.releases !== null)
      .map((entry) => entry.at);

    return {
      api: {
        builtAt: local.builtAt,
        current: local.version,
        latest: apiLatest?.version ?? null,
        latestUrl: apiLatest?.url ?? null,
        releasedAt: local.releasedAt,
        releases: apiReleases,
        startedAt,
        updateAvailable: apiLatest !== null && SemVer.isGreater(apiLatest.version, local.version),
      },
      app: {
        latest: appLatest?.version ?? null,
        latestUrl: appLatest?.url ?? null,
        releases: appReleases,
      },
      checkedAt: fetchedAt.length > 0 ? new Date(Math.max(...fetchedAt)).toISOString() : null,
      environment:
        AppEnvironment[this.env.appEnvironment.toUpperCase() as keyof typeof AppEnvironment],
    };
  }

  private async fetch(repo: string): Promise<CacheEntry> {
    try {
      const releases = await this.github.listReleases(repo);

      return { at: Date.now(), releases: toReleaseNotes(releases) };
    } catch (error) {
      // Never log the token: only the repository and the failure reason.
      this.logger.log(LogLevel.WARN, 'GitHub release check failed', {
        module: 'GetVersionInfoUseCase',
        reason: error instanceof Error ? error.message : 'unknown',
        repo,
      });

      return { at: Date.now(), releases: null };
    }
  }

  private isFresh(entry: CacheEntry, refresh: boolean): boolean {
    const ttl = entry.releases ? this.env.versionCheckTtlSeconds * 1000 : FAILURE_TTL_MS;
    const limit = refresh ? Math.min(ttl, REFRESH_MIN_AGE_MS) : ttl;

    return Date.now() - entry.at < limit;
  }

  private async load(repo: string | undefined, refresh: boolean): Promise<CacheEntry | null> {
    if (!repo) {
      return null;
    }

    const cached = this.cache.get(repo);

    if (cached && this.isFresh(cached, refresh)) {
      return cached;
    }

    const pending =
      this.inFlight.get(repo) ??
      this.fetch(repo).then((entry) => {
        this.cache.set(repo, entry);
        this.inFlight.delete(repo);

        return entry;
      });
    this.inFlight.set(repo, pending);

    return pending;
  }
}

function toReleaseNotes(releases: GithubRelease[]): ReleaseNotes[] {
  return releases
    .filter((release) => SemVer.parse(release.tagName))
    .map((release) => ({
      publishedAt: release.publishedAt,
      sections: ChangelogNotes.parse(release.body),
      url: release.url,
      version: release.tagName.replace(/^v/, ''),
    }))
    .sort((a, b) => SemVer.compare(b.version, a.version))
    .slice(0, MAX_RELEASES);
}
