FROM mcr.microsoft.com/devcontainers/javascript-node:22-bookworm

# Unlike the companion python repo, no linters/type-checkers are baked into the
# image: in a node project the entire toolchain (typescript, eslint, prettier,
# vitest) lives in devDependencies, pinned by package-lock.json and installed by
# postCreateCommand. The image only needs the runtime.

# Pre-create the Claude Code config dir owned by the container user, so the
# named volume mounted here initializes writable (a bare mount point would be
# root-owned and logins would fail to persist). This image's non-root user is
# `node` (not `vscode` as in python images).
RUN mkdir -p /home/node/.claude && chown node:node /home/node/.claude

# Let git operate on the bind-mounted workspace without tripping its
# "dubious ownership" guard. Docker Desktop presents the Windows-host checkout
# with an owner that isn't the container's `node` user, so git otherwise
# refuses every command (init/status/commit) until safe.directory is set. This
# is a single-developer, trusted container, so allowing any path is acceptable
# and keeps a fresh clone working with no in-container setup. Written to the
# system config (/etc/gitconfig) so it applies to every user in the image.
RUN git config --system --add safe.directory '*'
