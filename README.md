# Capture the Flag — Play in Your Browser

Capture the Flag is a two-player battlefield board game. Each player secretly
arranges an army of 48 pieces — soldiers, knights, towers, an assassin, and one
all-important flag — then the armies are revealed and the battle begins. Pieces
move and clash in full view, each rank with its own strengths, until one side
captures the other's flag.

This is the game's web app. It runs entirely in your browser — nothing to
install, no account, no server.

## What you can do

- **Play against a friend** on the same device, including the secret placement
  phase.
- **Replay finished games** from their game log files — step through a past
  battle move by move. _(coming soon)_
- **Play against the computer** — an AI opponent trained by the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  project. _(planned, once the AI engine is trained)_

> **Status:** early days — the project scaffolding is in place and the game
> itself is being built. Nothing playable yet.

## The rules

The official rulebook lives in the companion repository and is the single
source of truth:
[rules.md](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/rules.md)
(with a [change log](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/changelog.md)).
The rules evolve; this app keeps older rule versions around so that games
recorded under an earlier ruleset can always be replayed correctly.

## Development

The app is a TypeScript/React single-page application with no backend — it can
be served from any static file host. The repo ships a VS Code Dev Container
that provisions the full toolchain automatically; see
[CONTRIBUTING.md](CONTRIBUTING.md) for setup and conventions.
