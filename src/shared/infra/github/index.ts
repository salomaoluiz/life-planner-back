import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { EnvService } from '@shared/infra/env/env.service';

import { GithubRelease, IGithubReleases } from './types';

const GITHUB_API = 'https://api.github.com';
const TIMEOUT_MS = 3000;
const REPO_REGEX = /^[\w.-]+\/[\w.-]+$/;

interface RawRelease {
  body?: null | string;
  draft?: boolean;
  html_url?: string;
  prerelease?: boolean;
  published_at?: null | string;
  tag_name?: string;
}

@Injectable()
export class GithubReleases implements IGithubReleases {
  constructor(private readonly env: EnvService) {}

  async listReleases(repo: string): Promise<GithubRelease[]> {
    if (!REPO_REGEX.test(repo)) {
      throw new Error('Invalid GitHub repository name');
    }

    const token = this.env.githubToken;
    const response = await axios.get<RawRelease[]>(`${GITHUB_API}/repos/${repo}/releases`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      params: { per_page: 10 },
      timeout: TIMEOUT_MS,
    });

    return (Array.isArray(response.data) ? response.data : [])
      .filter((release) => !release.draft && !release.prerelease && release.tag_name)
      .map((release) => ({
        body: release.body ?? '',
        publishedAt: release.published_at ?? '',
        tagName: release.tag_name as string,
        url: release.html_url ?? '',
      }));
  }
}
