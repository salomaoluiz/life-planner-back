# Changelog

All notable changes to this project are documented here, newest first.
Format: [Keep a Changelog](https://keepachangelog.com).

## [1.1.0] - 2026-10-30

### Added

- `PATCH /api/v1/finance/categories/:id/appearance` applies icon and color to a category and its descendants in one transaction (spec 058).
- `GET /api/v1/finance/category-icons` searches a curated icon catalog in Portuguese and English, without accents, by prefix, with a typo fallback (spec 058).

## [1.0.0] - 2026-10-30

### Added

- Baseline: first versioned release.
- `GET /api/v1/version` exposes the API version and the latest released versions (spec 056).
