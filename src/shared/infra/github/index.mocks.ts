import { EnvService } from '@shared/infra/env/env.service';

const rawReleasesMock = [
  {
    body: '### Added\n- thing',
    draft: false,
    html_url: 'https://github.com/your-org/your-repo/releases/tag/v1.1.0',
    prerelease: false,
    published_at: '2026-10-30T09:00:00Z',
    tag_name: 'v1.1.0',
  },
  { draft: true, tag_name: 'v1.2.0' },
  { prerelease: true, tag_name: 'v1.3.0-rc.1' },
  { body: null, html_url: 'https://example.com', published_at: null, tag_name: 'v1.0.0' },
];

function envWith(githubToken?: string) {
  return { githubToken } as unknown as EnvService;
}

const mocks = { rawReleases: rawReleasesMock };

export { envWith, mocks };
