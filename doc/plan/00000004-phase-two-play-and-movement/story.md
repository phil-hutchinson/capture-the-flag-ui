# Story 00000004 — Phase 2 play: board, movement & turn alternation

## Summary

Begin Phase 2 of Capture the Flag: once both armies are placed, the board is
revealed to both players and they take turns moving pieces on a fully visible
battlefield. This story covers **movement onto empty squares only** — not
attacks, not capture, and not the conditions that end a game.

From a player's point of view: setup is done, I hand the device back and forth,
and on my turn I pick one of my pieces and slide it to an empty square it can
legally reach. Play strictly alternates — one move each, no passing. What this
story does _not_ yet let me do is attack an enemy piece (story 00000005) or win,
lose, or draw the game (story 00000006).

This is deliberately not a full vertical slice — like Phase 1's placement story,
it's a playable chunk of Phase 2 rather than a complete, winnable game.

## Background & references

The rules are owned by the companion
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository — `doc/ruleset/rules.md` is the single source of truth. Do not
restate the rules here. Relevant Phase 2 movement facts (to be re-confirmed
against the ruleset at plan time):

- Play **strictly alternates**, one move per player; **passing is never
  allowed**.
- The board is the same **12 × 12 grid** as Phase 1, but now **fully visible**
  to both players (Phase 2 is perfect-information).
- **Standard movement** is **one square orthogonally** (up/down/left/right) — no
  diagonals, no crossing lakes, no moving through another piece.
- **Skirmishers** may move **up to 3 squares in a straight line** for plain
  movement (path must be clear of pieces and lakes).
- **Towers and the Flag never move.**
- A **Knight** moving without attacking is limited to **one square** — the
  Knight "charge" (2–3 squares) exists only as an attack and therefore belongs
  to the combat story (00000005), not here.

This story builds directly on the **versioned initial game state** produced by
story 00000001. That artifact is the starting position; this story evolves it as
moves are made.

**Ruleset versioning:** movement legality is rule logic and must be organized
per ruleset version, consistent with story 00000001. The recorded sequence of
moves must remain replayable forever, so it must be tagged with (or derived
under) the ruleset version it was played on.

## Players and colors

Unchanged from story 00000001: first player = **White = Side A = red
(`#a13d2b`)**; second player = **Black = Side B = blue (`#33526b`)**;
player-facing surfaces refer to the sides by color (red / blue) and use the word
"move" (never "ply").

## In scope

1. **Transition into Phase 2 with full reveal.** From the neutral "both armies
   ready" end state of story 00000001, start Phase 2: both armies are now shown
   on one fully visible board. Red (first player) takes the first move.
2. **Board from the current player's perspective.** The board is always
   presented from the perspective of the player whose turn it is — their own
   home edge nearest them — and flips on each hand-off, just as Phase 1 oriented
   the board to the active placer. Even though Phase 2 is perfect-information,
   this keeps the hot-seat experience consistent and each player's own army in
   front of them.
3. **Turn alternation.** Strict one-move-per-player alternation with a clear
   indication of whose turn it is. Passing is not offered.
4. **Legal movement onto empty squares.** On their turn, the active player
   selects one of their own pieces and moves it to an empty square it can legally
   reach:
   - standard one-square orthogonal moves;
   - Skirmisher moves of up to 3 squares in a straight line;
   - Towers and the Flag cannot move;
   - moves are blocked by lakes and by any piece in the path; no diagonals.
     Illegal destinations are prevented structurally (not validated after the
     fact), mirroring how Phase 1 made illegal squares non-interactive.
5. **Accessible movement from the start.** Movement is operable by keyboard and
   perceivable by screen reader as it is built — not retrofitted later. Selecting
   a piece, seeing/hearing its legal destinations, moving it, and the turn
   indicator all work without a mouse and are announced to assistive technology.
   (Story 00000002 makes Phase 1 _placement_ accessible; this story must not
   introduce a new inaccessible interaction alongside it.)
6. **Recording moves into the game state.** Each move evolves the versioned game
   state from story 00000001, producing an inspectable record of the moves made
   so far (at minimum a developer-facing dump, as in Phase 1). Moves are recorded
   in a simple origin-destination coordinate form — e.g. `A2A3`, no separator and
   no combat-resolution markers (there is no combat in this story). This is the
   foundation that recorded-game replay will build on; it must anticipate replay
   without implementing it.

## Design decisions & constraints

- **Reuse, don't rebuild.** Reuse story 00000001's board rendering, side colors,
  themeable art, and game-state model. This story adds movement and turn state on
  top of that foundation rather than forking it.
- **Empty-square moves only.** Because attacks are out of scope, a square
  occupied by _any_ piece (friendly or enemy) is not a legal destination in this
  story. Attacking an adjacent enemy — and the Knight charge — arrive in story 00000005.
- **Not throwaway.** The move-recording model must be designed so combat
  (00000005), game-end (00000006), and eventual replay slot on top of it rather
  than forcing a rewrite.
- **Accessibility built in, not bolted on.** The board is a 12×12 grid; follow
  the same WAI-ARIA grid / composite-widget pattern story 00000002 establishes
  for placement (roving `tabindex`, arrow-key navigation, Enter/Space to act)
  rather than inventing a second, mouse-only movement interaction that would have
  to be retrofitted. If 00000002 has not yet landed, coordinate so the two
  stories share one grid interaction model.
- **Move coordinate format.** Keep it simple for now: origin square immediately
  followed by destination square (e.g. `A2A3`), with no separator and no
  combat-resolution indicators. Combat markers and any richer notation are a
  concern for later stories; this format is the minimum that the replay story can
  build on.
- **"Stuck with no move" is an accepted limitation here.** Because attacks are
  out of scope, a player could in principle have no legal empty-square move even
  though the full game would offer an attack. This is a known, acceptable rough
  edge for a work-in-progress story: it is handled quietly (no crash) and
  deliberately **not** tested or given special UI — the "no legal move" condition
  is implemented properly in story 00000006.
- **Player-facing text** continues to use the sides' colors (red / blue) and the
  word "move" (never "ply"), per repository conventions.

## Out of scope

- **Attacks, capture, and combat resolution** of any kind, including the Knight
  charge (story 00000005).
- **Victory, loss, and draw conditions** and the end-of-game UI (story
  00000006).
- AI opponent.
- Loading / replaying a saved game (the move record anticipates it; the feature
  is not built).
- Any networking or non-local multiplayer.
- Drag-and-drop (click interaction only, consistent with Phase 1).

## Manual-verification gates

These are hard stops: the implementation pauses for the owner to run the app and
confirm behavior automated tests cannot fully judge.

- **Gate A — Entering Phase 2.** From a completed Phase 1 setup, the app enters
  Phase 2 showing both armies on one fully visible board, correctly oriented,
  with a clear turn indicator and red to move first.
- **Gate B — Perspective flip.** The board is shown from the current player's
  perspective (their own home edge nearest them) and flips correctly on each
  hand-off, so on every turn the active player's army is in front of them.
- **Gate C — Legal movement & turns.** Standard one-square orthogonal moves,
  Skirmisher up-to-3 straight-line moves, immobile Towers/Flag, and blocking by
  pieces and lakes all behave correctly; no diagonal moves; turns strictly
  alternate and passing is never offered; occupied squares are not valid
  destinations.
- **Gate D — Accessible movement.** With the mouse put away, a full turn can be
  played by keyboard alone (select a piece, choose a legal destination, move),
  focus is always visible and never trapped; with a screen reader on, the active
  piece, its legal destinations, the move, and whose turn it is are announced.
- **Gate E — Move record.** After a sequence of moves, the evolved game-state
  artifact is inspectable and correctly reflects the moves made — in the simple
  `A2A3` coordinate form — along with the ruleset version, confirming the
  foundation for replay.

## Open items to resolve at plan time

The design decisions for this story are settled above (perspective flip,
built-in accessibility, the `A2A3` move format, and the accepted
"stuck-without-attacks" limitation). One mechanical confirmation remains:

- Re-read `rules.md` at the current ruleset version to confirm the movement
  model in full — Skirmisher range, that a non-charging Knight moves one square,
  the complete list of immobile pieces, and that **no other** piece type has a
  movement quirk beyond these (i.e. the Assassin and all ranked pieces move the
  standard one square orthogonally).

## Notes — anticipated follow-on stories

Phase 2 is being delivered as three stories. This one (00000004) is the first.
The next two are already created and will build on it:

- **Story 00000005 — Phase 2 combat: attacks & capture resolution.** Moving onto
  an occupied enemy square resolves an encounter, and Knights gain the "charge"
  (a 2–3 square straight-line move that exists only as an attack). This story
  implements the rank-based combat rules and their special cases — lower rank
  wins, equal-rank mutual loss, the Assassin (wins when attacking, loses when
  attacked), Archer support, "a Knight may not charge a Halberdier," the
  Knight-vs-Knight charge exception, and Sappers as the only piece that destroys
  Towers. This is expected to be the largest of the three.

- **Story 00000006 — Phase 2 game-end: victory, draws & losses.** Detect and
  present all the ways a game ends: flag capture, the "unbreachable flag" win, a
  player with no legal move losing, the per-player inactivity loss, the
  no-progress draw, and draw by mutual agreement — with the end-of-game UI. This
  is what finally makes a game winnable end-to-end.
