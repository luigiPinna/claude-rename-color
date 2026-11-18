# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-11-18

### Added

- Icon for the Claude plugin directory.
- README: demo GIF, screenshots, configuration, limitations, and a section on what the mod reads and runs.
- This changelog.

## [0.1.0] - 2026-11-17

### Added

- `/rnc [name] [color]`: renames and colors the session in one command.
- `/rnc` with no arguments: names the session `folder · branch` (git worktrees included) and picks a stable color from the folder name.
- `autoOnStart` option (off by default): applies `/rnc` to every new interactive session; resumed sessions keep their name.

[0.1.1]: https://github.com/luigiPinna/claude-rename-color/compare/945f852...rename-color--v0.1.1
[0.1.0]: https://github.com/luigiPinna/claude-rename-color/commit/945f852
