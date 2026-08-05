# Story 00000002 — Accessible placement board (keyboard & screen reader)

## Summary

Make the Phase 1 placement experience fully usable without a mouse and
perceivable without sight. A player who navigates by keyboard, or who relies on
a screen reader, should be able to set up their entire army — with no change to
how placement already works for players using a mouse or touch.

This story is presentation and interaction only: it does not change the rules,
the game engine, or the placement operations themselves, only how a player
reaches and perceives them.

## Background & references

Story 00000001 (create board layout tool) deliberately scoped Phase 1 placement
to click-only interaction. Its peer review recorded the resulting accessibility
gap — see findings #1 and #2 in
[`doc/plan/00000001-create-board-layout-tool/peer-review.md`](../00000001-create-board-layout-tool/peer-review.md).
The contradictory `role="img"`/`aria-hidden` markup from finding #2 was fixed
during that story; this story picks up the rest: keyboard operability and
accessible names.

**Phase 2 got there first.** This story was written when the app was placement
only; since then story 00000004 built Phase 2 play on a reusable accessible
grid (`src/board/grid/AccessibleGrid.tsx` and `gridNavigation.ts`), whose header
comment names this story as its second intended consumer. Phase 2's `FullBoard`
already uses it. This story is therefore mostly a **port of the Phase 1
placement board onto that existing component**, not a fresh design — see
"Design decisions & constraints" below.

**Two editions, not one board.** Story 00000023 introduced playable editions:
Battle (12×12 board, full roster) and Skirmish (8×8 board, smaller roster). Any
board or army figure below is per-edition; nothing may assume Battle's
dimensions. Story 00000025 added Skirmish's Tower lane restriction, which gives
some squares a "closed to Towers" state the original story predates.

The rules are owned by the companion
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository — `doc/ruleset/rules.md` is the single source of truth. This story
does not touch the rules; no ruleset version change is involved.

## In scope

1. **Keyboard operation of the whole placement flow.** Using only the keyboard,
   a player can reach the tray and the board, select a piece type, choose a
   square, and trigger every action a mouse user can: place, move, swap, return
   a piece to the tray, clear the board, auto-fill, and confirm / hand off.
2. **A screen-reader-perceivable board.** Each square announces its contents —
   empty, a lake, or a specific piece and its side (color) — and its position on
   the board. Where the active edition closes a square to Towers, a player who
   cannot see the visual marking can still tell (either from the square's own
   name or from the existing live-region hint — a plan-time choice). The tray
   announces each piece type and its remaining count. Turn and progress
   ("N / M placed", M being the active edition's army size), and the confirm /
   hand-off, are announced.
3. **Accessible names for placed pieces.** Placed-piece squares carry an
   accessible name derived from the piece's display name and side color (this is
   the deferred half of story 00000001's peer-review finding #2). The decorative
   piece and lake SVG icons remain `aria-hidden`.

## Design decisions & constraints

- **Adopt the existing accessible grid; do not design a new one.** Making every
  square individually tabbable is poor UX (Battle's board alone would be 144 tab
  stops). `src/board/grid/AccessibleGrid.tsx` already implements the WAI-ARIA
  grid composite-widget pattern — `role="grid"`/`row`/`gridcell`, roving
  `tabindex`, arrow-key navigation with edge clamping (no wraparound),
  Enter/Space activation, and a polite live region driven by the consumer.
  Placement adopts it, and matches Phase 2's conventions (see `FullBoard.tsx`,
  whose `squareLabel` already produces "square name plus what occupies it").
  The tray already uses native `<button>`s and stays as it is.
- **The real design problem is the partial board view.** Unlike Phase 2's full
  board, placement renders a partial, non-uniform view: the active player's home
  rows plus a greyed, non-interactive buffer row and lake row (`Board.tsx`).
  Mapping that onto the grid's rectangular row/column space — and deciding
  whether the non-interactive bands are focusable-but-not-actionable cells or
  outside the grid entirely — is this story's genuine new decision.
- **Map the click grammar onto keys.** Placement's move / swap / return-to-tray
  grammar is expressed today as sequences of clicks (`HotSeatGame.tsx`), with
  return-to-tray and clear-board as explicit buttons in `PlacementControls`.
  Every one of those must have a keyboard route; the plan chooses how.
- **No behavior change for existing input.** Mouse and touch placement must
  continue to work exactly as it does today; the manual gates from story
  00000001 must still pass.
- **Catch regressions in lint.** Add `eslint-plugin-jsx-a11y` to the eslint
  config as part of this story, so this class of issue is caught automatically
  going forward. (Owner decision, 2026-08-05.)
- **Player-facing text** continues to use the sides' colors (red / blue — via
  the one canonical `sideColorName` in `src/board/sideNames.ts`, never the
  internal "white"/"black") and the word "move" (never "ply"), per repository
  conventions.

## Out of scope

- Drag-and-drop placement (deferred separately by story 00000001).
- Phase 2 play (movement, combat, the reveal of the opponent's pieces) — already
  accessible as of story 00000004, and not revisited here.
- **The AI opponent's placement screen.** `EngineGame.tsx` renders its own copy
  of the placement screen, but it is parked: `App.tsx` does not route to it and
  the start-screen button is disabled until the engine is respecified for the
  major-2 rules. It must keep compiling and passing typecheck/lint as `Board`'s
  API changes, and it may be updated mechanically to match, but it is not
  separately verified by this story's gates. (Owner decision, 2026-08-05.)
- Loading / replaying a saved game.
- Automated DOM / component test coverage for the accessible grid — see
  "Verification" below.
- Any change to the ruleset, the game engine, or the placement operations.

## Verification

**Manual only. (Owner decision, 2026-08-05.)** The repository's Vitest
environment is `node`-only, with no jsdom and no component-testing library, so
ARIA roles, roving tabindex, keyboard interaction and live-region content cannot
be asserted automatically today. Introducing that environment is its own story —
[`doc/plan/proposed-stories/automated-accessibility-and-dom-testing.md`](../proposed-stories/automated-accessibility-and-dom-testing.md),
still proposed — and is deliberately kept out of this one to avoid scope creep.
This story follows Phase 2's precedent (story 00000004, Gate D): any **pure**
logic it adds is unit-tested, `eslint-plugin-jsx-a11y` guards the static markup,
and the interaction itself is verified by the manual gates below.

### Manual-verification gates

Accessibility is judged by exercising the app with the mouse put away and with a
screen reader on; these are hard stops for owner confirmation. Verify against
**Windows Narrator**, matching story 00000004's Gate D — note that a screen
reader must be in focus mode for arrow navigation to reach the grid (Narrator:
Caps Lock + Space to leave scan mode). Run each gate for **both editions**:
Battle and Skirmish differ in board size, roster, and Tower restrictions.

- **Gate A — Keyboard-only placement.** With the mouse unplugged/untouched,
  complete a full placement (select from the tray, place, move, swap, return to
  tray, clear, auto-fill) and confirm the hand-off — all by keyboard. Focus is
  always visible and never trapped.
- **Gate B — Screen-reader perception.** With a screen reader running, confirm
  that squares announce their contents and position, the tray announces types
  and remaining counts, and turn / progress / confirm are announced. Neither
  player's confirmed layout leaks in the neutral end state.
- **Gate C — No regression for mouse/touch.** The story 00000001 placement gates
  still pass unchanged.

## Open items to resolve at plan time

Three of this story's original open items were settled on 2026-08-05 and are
recorded above: the grid keyboard model comes from the existing
`AccessibleGrid`, `eslint-plugin-jsx-a11y` is adopted here, and verification is
manual against Windows Narrator. What remains:

- How the partial board view (home band, plus non-interactive buffer and lake
  rows) maps onto the grid's rectangular row/column space.
- How "pick up a piece, then choose a destination" maps onto keys, and how
  return-to-tray / clear / auto-fill / confirm are reached — reusing Phase 2's
  select-then-activate conventions where they fit.
- Whether "closed to Towers" belongs in the square's accessible name, in the
  existing `PlacementStatus` live-region hint, or both.

## Findings deferred here from story 00000023

Story 00000023's peer review turned up three more accessibility findings,
owner-deferred to this story rather than fixed there (see that story's
`peer-review.md`, comments #3, #10, #13). All three were re-confirmed against
the branch point on 2026-08-05; the line references below are current as of
then, and the plan should re-locate rather than trust them:

- **Game-choice live region mounts together with its text.** The Battle/
  Skirmish choice's announcement paragraph (`role="status" aria-live="polite"`)
  only exists in the placement branch of `HotSeatGame.tsx`, which renders for
  the first time in the same update that sets its text — a screen reader may
  not announce content inserted together with the live region itself.
  `src/board/HotSeatGame.tsx#L771-L783`.
- **Focus drops to `<body>` when `GameChoice` unmounts.** Choosing a game
  unmounts `GameChoice` (including the focused "Play &lt;Game&gt;" button)
  without moving focus anywhere, dropping a keyboard user back on `<body>` at
  the start of placement. `HotSeatGame`'s heading-focus effect does not cover
  this: its dependency array is empty, so it fires once when the component
  mounts on the game-choice screen and never again on the branch change into
  placement. `src/board/HotSeatGame.tsx#L303-L306`.
- **Native `disabled` removes "Play against the computer" from the tab
  order.** The start-screen button uses the native `disabled` attribute, so a
  keyboard/screen-reader user tabbing through the start screen never reaches
  it or its explanatory note. `src/app/StartScreen.tsx#L55-L74`.
