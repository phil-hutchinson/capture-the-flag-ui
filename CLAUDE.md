# Claude project context

## Project

This repository is the web app for Capture the Flag: a two-phase,
perfect-information battlefield board game (phase 1 is secret simultaneous
placement, phase 2 is alternating perfect-information play). The app is a
**front-end only** TypeScript/React single-page application — no backend API;
it must be deployable from a static file host. It supports human-vs-human play
and replaying recorded games from log files; playing against the trained AI
(via the companion project's models) comes later.

The game itself — ruleset, engine, and AI training — lives in the companion
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository. `doc/ruleset/rules.md` **in that repository** is the single source
of truth for the rules (with `doc/ruleset/changelog.md` recording changes).
Do not restate or fork the rules here; link to them.

**Ruleset versioning:** recorded games must remain replayable forever. Rule
logic in this codebase is organized per ruleset version — a rules change means
adding a new version alongside the old ones, never rewriting existing rule
logic that recorded games depend on.

## Ownership

The AI assistant owns the architecture and the code, within these constraints:

- Node.js/TypeScript, modern libraries and approaches.
- Major, well-maintained libraries only — no little-known or personal
  third-party packages (the companion capture-the-flag repository being the
  deliberate exception).

The repository owner owns the processes and, together with the assistant,
writes the stories. Story numbers come from GitHub and are usually chosen by
the owner.

## Intended audience

Unlike the companion repository (which targets a technical audience), the
primary audience here is **players of the game**. Player-facing text — the UI
itself, README.md, error messages — should be written for a non-technical
reader. When writing user stories, the "user" is typically a player (playing,
replaying, or setting up a game), not a developer. Technical depth belongs in
CONTRIBUTING.md, code, and planning documents.

## Conventions

See [CONTRIBUTING.md](CONTRIBUTING.md) for the toolchain, dependency policy,
and architecture constraints.

## Story Documentation

The folder `doc/plan/{story-name}/` (where the story name can be derived from
the branch) will contain the following, as needed. Pad the story number to 8
digits.

- **`story.md`** — the original story describing what was requested
- **`implementation-plan.md`** — the plan describing what was intended to be implemented
- **`peer-review.md`** — a peer review that also includes status and resolution of peer review items

Note: please do not make references to products with trademarked names.

## Implementation Strategy

Stories are implemented through the `/implement-story` pipeline
(`.claude/commands/implement-story.md`): an orchestrator in the main session
dispatches fresh-context agents (`.claude/agents/`) for the expensive phases —
creating the implementation plan, implementing each step, peer-reviewing, and
processing the review. The **`implementation-plan.md`** contains one or more
steps, each with a verification strategy, and doubles as the pipeline's state:
agents record per-step Status and Notes there, so the process is resumable
from a fresh session.

Steps are implemented one at a time, each verified (typecheck, lint, tests,
plus the step's own verification) and committed before the next begins. The
process pauses for the owner only at defined gates: plan approval, manual
verification steps, escalations (a step failing repeatedly), and final
sign-off after peer review — not after every step. Always check for files
that have not been committed before beginning a step: if there are
uncommitted files, **stop** and verify whether the owner wants to commit them
before continuing.

Stories should be orchestrated from a session running an opus-class (or
stronger) model; the agents set their own models.

## Creation of Implementation Plans

Before creating or modifying an `implementation-plan.md`, read
`doc/guidelines/implementation-plan-guide.md` and follow it exactly.

## Vocabulary

For this repository, the following terms should be used:

**Ply** — a single action taken by one player in a turn-based game. Preferred
over "move" to avoid ambiguity: in common usage "move" can mean one player's
action _or_ a full round of actions by all players. A ply is always
unambiguous — it refers strictly to one player's turn.

**Exception — player-facing text.** The official rules are written for a
non-technical player audience and deliberately use **"move"** (not "ply") for
this same concept. Player-facing surfaces in this repository — UI text,
README.md, anything a player reads — follow the rules document and use
"move." Everywhere else (code, tests, plans, design docs) use "ply."
