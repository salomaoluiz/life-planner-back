const versionOutputMock = {
  api: {
    builtAt: '2026-10-27T21:40:00Z',
    current: '1.12.0',
    latest: '1.13.0',
    latestUrl: 'https://github.com/example/life-planner-back/releases/tag/v1.13.0',
    releasedAt: '2026-10-27',
    releases: [
      {
        publishedAt: '2026-10-30T09:20:00Z',
        sections: [{ items: ['Version endpoint (spec 056).'], type: 'ADDED' }],
        url: 'https://github.com/example/life-planner-back/releases/tag/v1.13.0',
        version: '1.13.0',
      },
    ],
    startedAt: '2026-10-27T21:44:00Z',
    updateAvailable: true,
  },
  app: { latest: null, latestUrl: null, releases: [] },
  checkedAt: '2026-10-30T09:58:00Z',
  environment: 'PRODUCTION',
};

const mocks = { versionOutput: versionOutputMock };

export { mocks };
