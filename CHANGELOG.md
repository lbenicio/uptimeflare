# Changelog

All notable changes to this project are documented in this file.

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-11-24

### Added

- Added this changelog and public deployment and contribution guidance.
- Added support for optional, deployer-owned Umami analytics configuration.
- Licensed the project under the GNU General Public License v3.0.

### Changed

- Resolved the D1 database UUID by name through Wrangler during Cloudflare builds, removing the separate `UPTIMEFLARE_D1_DATABASE_ID` build variable.
- Restricted automatic pull request merges to Dependabot and reduced workflow token permissions.
- Documented the optional runtime Cloudflare API secret used for edge-certificate checks.
- Expanded ignore rules for local environment files, Terraform variable files, and private keys.

### Fixed

- Disabled the repository owner's analytics property by default so other deployments do not send visitor events to it.
