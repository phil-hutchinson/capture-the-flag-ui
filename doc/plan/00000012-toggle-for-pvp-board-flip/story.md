# Story 00000012 — Toggle for the two-player board flip

## Summary

Add a toggle switch that lets players turn the Phase 2 board flip off. Today
the board is always drawn from the perspective of the player currently at the
board: it flips at every hand-off, and flips again to the responder while a
draw offer is answered. For a genuine hot-seat game between two people that
is exactly right — each player sees their own home edge nearest them. But
when one person is playing both sides (self-play, fiddling, exploring a
position), the constant reorientation is disorienting.

With the new toggle switched off, the Phase 2 board simply stays put: it is
always drawn from red's perspective — during normal play, while a draw offer
is being answered, and in the end-of-game presentation. Blue then plays
"upside down," moving toward the viewer — which is precisely what a
self-player wants. Switching the toggle back on restores today's behavior
unchanged.

Phase 1 is untouched: placement is secret and each player always places from
their own perspective, regardless of the toggle.

## Background & references

- The flipping behavior being toggled was built in stories 00000005 (the
  hand-off flip, `viewSide` in `src/board/playSession.ts`) and 00000006 (the
  draw-offer exception: the board turns to the responder's perspective while
  they answer).
- This is a **view-only** setting. It has no effect on the rules, the game
  state, whose turn it is, the draw-offer flow, or the game record — only on
  which way up the board is drawn. No ruleset-version concerns apply.
- Perspective terms: red = the first player (Side A / White), blue = the
  second player (Side B / Black), per story 00000001. Player-facing text uses
  the colors.

## Policy (fixed by the owner, 2026-07-12)

- **Default: flipping on.** Current behavior is the out-of-the-box behavior;
  hot-seat play needs no setup, and self-players opt out.
- **Changeable anytime, effective immediately** — including mid-game, while a
  draw offer is pending, and at the end-of-game presentation. Changing it
  never alters game state; the board just redraws the current position in the
  new orientation.
- **Persisted in the browser** (local storage), so a self-player is not
  switching it off on every visit. The setting survives page reloads and
  carries across games; it is a device setting, not part of any game or
  record.
- **Label:** the switch is labeled **"Flip board between turns"** — plain
  player language, no jargon.
- **Placement:** the toggle lives with the Phase 2 play UI and is available
  throughout Phase 2 (play, draw offers, game end). It is not shown during
  Phase 1, where it has no effect.

## In scope

1. **The toggle switch.** A player-facing switch, "Flip board between
   turns," visible throughout Phase 2, on by default, persisted in local
   storage, and taking effect the moment it is changed.
2. **Flipping off ⇒ red's perspective, always.** With the toggle off, every
   Phase 2 view is drawn from red's perspective: normal play for both sides,
   the board shown to the responder while a draw offer is pending, and the
   final position after the game ends.
3. **Flipping on ⇒ today's behavior, exactly.** The hand-off flip and the
   draw-offer perspective exception behave as they do now; turning the toggle
   off and back on mid-game returns to the orientation the current player
   would have had.
4. **Orientation-dependent presentation stays correct in both modes.** Any
   UI text or announcement that depends on which player is viewing the board
   (status text, screen-reader announcements, square announcements) must
   remain accurate whichever way the board is drawn — the toggle changes the
   drawing, never whose turn it is or what is announced as happening.
5. **Accessible from the start.** The switch is operable by keyboard, its
   state (on/off) is perceivable without relying on color alone, and its
   label and state are conveyed to assistive technology, consistent with the
   established accessibility patterns.

## Design decisions & constraints

- **View-only, one seam.** The natural home for this is the existing
  `viewSide` logic: with flipping off it always answers red. The setting must
  not fork the session model, add a second board component, or touch the
  versioned rules code.
- **No change to the draw-offer flow.** An offer still hands the decision to
  the opponent and still makes the board inert; with flipping off, the only
  difference is that the board does not turn while they answer.
- **Persistence is best-effort.** If local storage is unavailable (e.g.
  blocked by the browser), the app works normally with the default, without
  errors.
- **Phase 1 is out of reach.** The toggle neither appears in nor affects
  Phase 1; secret placement always uses the placing player's perspective.
- **Player-facing text** uses the sides' colors (red / blue) and the word
  "move" (never "ply"), per repository conventions.

## Out of scope

- Any change to Phase 1 placement or its hand-off.
- Per-player or per-side preferences (one setting for the device).
- A "view from blue's perspective" mode or free board rotation — the
  non-flipping orientation is red's, full stop.
- Recording the setting in game records or making it part of any ruleset.
- A general settings screen; this is a single switch in the play UI.

## Manual-verification gates

- **Gate A — Toggle off, mid-game.** Starting from a Phase 2 game in
  progress on blue's turn (board drawn from blue's perspective), switching
  the toggle off immediately redraws the board from red's perspective, and
  subsequent hand-offs no longer flip it. Both sides can select, move, and
  attack normally in the fixed orientation.
- **Gate B — Draw offers, both modes.** With flipping off, red offers a draw
  and the board stays on red's perspective while blue answers; declining and
  accepting both behave as today. Switching the toggle back on restores the
  responder-perspective behavior.
- **Gate C — Persistence and default.** The switch is on by default on first
  visit; turning it off, reloading the page, and starting a new game finds it
  still off; turning it back on persists likewise.
- **Gate D — Accessibility.** The switch can be found and operated by
  keyboard alone; a screen reader announces its label and current state when
  focused and when toggled; its state is visually clear without color alone.

## Open items to resolve at plan time

Presentation details only — the policy above is fixed:

- Exactly where in the Phase 2 layout the switch sits and its visual form
  (switch vs. labeled checkbox), consistent with the existing UI.
- The local-storage key name and the read/write seam (a small persistence
  helper vs. inline), whichever fits the existing session/state structure.
