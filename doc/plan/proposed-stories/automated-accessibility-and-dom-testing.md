# Proposed story — Automated accessibility / DOM test coverage for the accessible grid

**Status:** proposed (not yet a numbered story). Story numbers come from GitHub
and are chosen by the repository owner; do not assign one here or create a
numbered `doc/plan/NNNNNNNN-…` folder until it is picked up.

## Motivation

Story 00000004 built a reusable accessible grid (`src/board/grid/`) implementing
the WAI-ARIA grid composite-widget pattern: `role="grid"`/`row`/`gridcell`,
roving `tabindex`, arrow-key navigation with edge clamping, Enter/Space
activation, and a polite live region for announcements. Only the **pure
navigation math** (`gridNavigation.ts`) has automated tests. The ARIA roles,
roving-tabindex behavior, keyboard interaction, focus management, and
live-region announcement content are verified **only manually** (story 00000004,
Gate D).

That leaves the grid's accessibility with no automated regression coverage: a
future refactor could silently break keyboard operation or screen-reader
output, and nothing would fail in CI. This is the single largest untested
surface introduced by story 00000004.

## Proposed scope

Introduce a DOM/component test environment and add automated coverage for the
accessible grid:

- Add a DOM environment (e.g. jsdom) and a well-maintained component-testing
  library (e.g. Testing Library), optionally with an ARIA/accessibility
  assertion helper. The repo's Vitest environment is currently `node`-only with
  no jsdom and no component-testing library — this story is what changes that.
- Add tests for the accessible grid covering:
  - roving-tabindex invariants (exactly one cell tabbable at a time),
  - arrow-key focus movement and edge clamping (no wraparound, no trapping),
  - Enter/Space (and click) activation calling back only for actionable cells,
  - live-region announcement content on selection, movement, and turn hand-off.
- Retrofit the same style of coverage onto any other interactive components that
  exist by the time this is picked up.

## Dependencies / constraints

- This is primarily a **tooling/dependency decision** (new dev-dependencies),
  intentionally left out of story 00000004's scope.
- It must follow the repository dependency policy in `CONTRIBUTING.md`: major,
  well-maintained libraries only — no little-known or personal packages.

## Relationship to other stories

- Story 00000002 (accessible Phase-1 placement) is expected to adopt the same
  accessible grid model, so its accessibility would be covered by this same test
  stack once the grid is under automated test — an additional reason to do this
  before or alongside 00000002 rather than after.
