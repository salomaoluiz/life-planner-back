const mocks = {
  bodyWithLinks: '### Added\n- [Link](http://example.com) **bold** thing\n### Fixed\n- a',
  bodyWithoutHeadings: 'First line\n\n- second line\n',
  manyBullets: `### Added\n${Array.from({ length: 11 }, (_, i) => `- item ${i}`).join('\n')}`,
};

export { mocks };
