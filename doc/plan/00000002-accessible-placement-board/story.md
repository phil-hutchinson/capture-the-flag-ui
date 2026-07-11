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
   the board. The tray announces each piece type and its remaining count. Turn
   and progress ("N / 48 placed"), and the confirm / hand-off, are announced.
3. **Accessible names for placed pieces.** Placed-piece squares carry an
   accessible name derived from the piece's display name and side color (this is
   the deferred half of story 00000001's peer-review finding #2). The decorative
   piece and lake SVG icons remain `aria-hidden`.

## Design decisions & constraints

- **Use a proper grid interaction pattern, not 144 tab stops.** The board is a
  12×12 grid; making every square individually tabbable is poor UX. Follow the
  WAI-ARIA grid / composite-widget guidance: a roving `tabindex`, arrow-key
  navigation within the grid, and Enter/Space to act. The existing tray already
  uses native `<button>`s and is a good baseline for the tray side.
- **No behavior change for existing input.** Mouse and touch placement must
  continue to work exactly as it does today; the manual gates from story
  00000001 must still pass.
- **Catch regressions in lint.** Consider adding `eslint-plugin-jsx-a11y` so
  this class of issue is caught automatically going forward.
- **Player-facing text** continues to use the sides' colors (red / blue) and the
  word "move" (never "ply"), per repository conventions.

## Out of scope

- Drag-and-drop placement (deferred separately by story 00000001).
- Phase 2 play (movement, combat, the reveal of the opponent's pieces).
- AI opponent.
- Loading / replaying a saved game.
- Any change to the ruleset, the game engine, or the placement operations.

## Manual-verification gates

Accessibility is judged by exercising the app with the mouse put away and with a
screen reader on; these are hard stops for owner confirmation.

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

- Choose the exact grid keyboard model (arrow-key wrap behavior, how "pick up a
  piece then choose a destination" maps onto keys, how return-to-tray / clear /
  auto-fill / confirm are reached).
- Decide whether to adopt `eslint-plugin-jsx-a11y` as part of this story or note
  it as a separate follow-up.
- Confirm the target screen reader(s) / browser combinations to verify against.
