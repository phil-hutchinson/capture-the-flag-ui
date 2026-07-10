# Contributing

## Development environment

The repository ships a [VS Code Dev Container](.devcontainer/) as the supported
development environment. With Docker and the VS Code **Dev Containers**
extension installed, open the repository and choose **Reopen in Container**.
The container provisions everything on first build: Node 22, the project's
dependencies, and the linting/formatting/testing toolchain — no manual setup
on the host (the container is the isolation boundary).

Personal environment variables (e.g. `TZ=America/Vancouver`) can be set
container-wide in `.devcontainer/devcontainer.env` — one `KEY=VALUE` per line.
To get started, rename (or copy)
[`devcontainer.env.example`](.devcontainer/devcontainer.env.example) to
`devcontainer.env`, edit it, and rebuild the container. The file is gitignored
and created empty on first container start if absent, so it is entirely
optional.

## Toolchain

Run from the container terminal, from the repository root:

```bash
npm run dev           # start the Vite dev server (forwarded to the host on :5173)
npm run typecheck     # type check (tsc)
npm run lint          # lint (eslint)
npm run format:check  # formatting check (prettier); `npm run format` to fix
npm test              # run the test suite (vitest)
npm run build         # type check + production build into dist/
```

Type check, lint, formatting check, and tests should all pass clean before a
change is submitted.

## Dependencies

- **Node/TypeScript**, current LTS Node and modern language standards.
- Prefer **major, well-maintained libraries**; do not add small or personal
  third-party packages. (The companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository is the one deliberate exception, as the source of the ruleset and
  eventually the trained AI models.)
- Exact dependency versions are pinned by `package-lock.json`, which is
  committed. Dependency bumps should be deliberate commits of their own, with
  a note on why.

## Architecture constraints

The app is **front-end only**: a static single-page application with no
backend API, deployable from any static file host (e.g. an S3 bucket). Every
feature — play, replay, and eventually playing against the trained model —
must run entirely in the browser.

The official ruleset lives in the companion repository
([rules.md](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/rules.md))
and is the single source of truth. Because recorded games must remain
replayable, rule logic in this codebase is organized per ruleset version:
implementing a rules change means adding a new version alongside the old ones,
never editing history out from under existing game logs.
