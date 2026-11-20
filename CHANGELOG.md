# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-11-20

### Added

- `/rnc <color>` and `/rnc <name> <color>` remember the color: the project folder or the name keeps it in later sessions. `/rnc default` (or `/rnc <name> default`) forgets it.

### Changed

- `/rnc` follows the folder the session works in, not only the one it started in: the git repository around the current directory gives the name and the color. A session opened in the home folder that moved into a project is named after the project.
- `/rnc <name>` without a color takes the color remembered for that name, or one computed from the name, instead of the start folder's color. Different names now get different colors.

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

[0.2.0]: https://github.com/luigiPinna/claude-rename-color/compare/rename-color--v0.1.1...rename-color--v0.2.0
[0.1.1]: https://github.com/luigiPinna/claude-rename-color/compare/945f852...rename-color--v0.1.1
[0.1.0]: https://github.com/luigiPinna/claude-rename-color/commit/945f852
