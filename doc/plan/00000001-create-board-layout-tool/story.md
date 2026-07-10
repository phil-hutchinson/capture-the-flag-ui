# Story 00000001 — Create board layout tool (Phase 1 placement)

## Summary

Build the Phase 1 experience of Capture the Flag: two players, one after the
other, secretly arrange their army on their own half of the board. This story
covers *placement only* — not Phase 2 play, not an AI opponent, and not
loading or replaying a saved game.

From a player's point of view: I sit down, I see my own home rows in front of
me, I place my whole army where I want it, I confirm, and I hand the device to
my opponent — without either of us having learned anything secret about the
other's setup. When both armies are placed, the game is set up and ready
(Phase 2 will pick up from here in a later story).

## Background & references

The rules are owned by the companion
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository — `doc/ruleset/rules.md` is the single source of truth. Do not
restate the rules here. Relevant Phase 1 facts (to be re-confirmed against the
ruleset at plan time):

- The battlefield is a **12 × 12 grid**.
- Each player owns **4 home rows** at their own edge; a neutral buffer row and
  the lake rows sit between the two home zones.
- Lakes occupy the pattern `O L L O O L L O O L L O` across the two lake rows,
  forming three 2×2 lakes. Lake squares are impassable terrain.
- Each player places their **entire army** into their four home rows. There are
  12 piece types (Lord Marshal, Champion, Knight, Infantry, Halberdier,
  Militia, Skirmisher, Archer, Sapper, Assassin, Tower, Flag). Per-type counts
  come from the ruleset and **must be verified against it at plan time** — this
  story must not hard-code guessed counts.
- Placement is simultaneous and secret in the physical game; we realize this as
  sequential hot-seat placement (see "Hand-off" below).

**Ruleset versioning:** the rule/terrain/inventory logic used here must be
organized per ruleset version, and the initial-state artifact this story
produces must record the ruleset version it was created under, so recorded
games stay replayable forever.

## Players and colors

- The **first player** is internally referred to as **White**; the **second
  player** as **Black**. This is dev shorthand for turn order only.
- On screen, the two sides are the **red** and **blue** tokens from the piece
  art. First player (White) = **Side A = red (`#a13d2b`)**; second player
  (Black) = **Side B = blue (`#33526b`)**. Player-facing surfaces refer to the
  sides by color (red / blue).

## In scope

1. **Board rendering from the active player's perspective.** The active player
   sees their own 4 home rows at the bottom, interactive. Above them, the
   neutral buffer row and a sliver of the first lake row are shown **greyed and
   non-interactive**, purely as a visual reminder of where the lakes are. The
   board is oriented/flipped so each player sees their own home zone in front of
   them.
2. **Piece tray + inventory.** A palette of the player's remaining pieces,
   showing each type with a live remaining count, rendered with the real piece
   icons (see "Art").
3. **Placement — click to select, then click to place.** Select a piece in the
   tray, click an empty home square to place it; the tray count decrements.
   (Drag-and-drop is explicitly deferred to a later story; click is the primary
   and only interaction for this story.)
4. **Interacting with placed pieces.** Move a placed piece to another square,
   swap two placed pieces, return a placed piece to the tray, and clear the
   whole board back to the tray.
5. **Completeness gating + progress.** Show placement progress (e.g. "42 / 48
   placed"). The Confirm action stays disabled until the entire army is placed.
   Illegal squares (lakes / buffer / opponent territory) are non-interactive, so
   illegal placement is prevented structurally rather than validated after the
   fact.
6. **Auto-fill / randomize.** A one-click action that fills only the remaining
   empty home squares with the player's remaining pieces — never onto lakes,
   always respecting remaining counts.
7. **Confirm + hand-off.** When the active player confirms a complete army, the
   app immediately presents the *next* player with an **empty** board from that
   player's own perspective. Because the confirming player's layout is already
   off-screen and the incoming player's army has not been placed yet, handing
   over the device at this moment leaks nothing. No separate privacy interstitial
   is required — the confirm *is* the hand-off.
8. **Neutral "both armies ready" end state.** After the second player (Black)
   confirms, the app lands on a neutral state that reveals **neither** layout
   (there is no reveal in this story — that belongs to Phase 2).
9. **Versioned initial game state.** Completing setup produces a serialized
   initial game state (both armies placed, tagged with the ruleset version)
   that is inspectable — at minimum a developer-facing dump (e.g. JSON) — so the
   produced artifact can be confirmed correct and complete. This data model is
   the foundation Phase 2 and replay will build on; it must anticipate replay
   without implementing it.

## Design decisions & constraints

- **Not throwaway.** The output of this story is the versioned initial game
  state described above, designed so Phase 2 and recorded-game replay slot on
  top of it rather than forcing a rewrite.
- **Themeable colors without new glyphs.** Board background and side colors must
  be changeable without editing the piece glyphs. Re-tokenize the prototype
  art's literal hex into CSS custom properties: side colors via
  `currentColor` / `var(--side-a|b)`, and the four `#e8dfc8` "cutout" colors
  (Champion, Knight, Infantry, Tower) to reference the board-background variable
  so they always track the actual board color. The exact palette and mechanism
  are left to the plan.

## Art

Prototype piece icons and renderer notes exist in the gitignored `.local/`
directory (`ctf-tile-prototype.svg`, `ctf-tile-prototype.md`): one
self-contained `<symbol>` per piece type at 64×64, plus documented side colors,
rank codes, and the cutout caveat above. This story pulls those glyphs into the
repo (re-tokenized per the themeability constraint); it does not create new
glyphs.

## Out of scope

- Phase 2 play (movement, combat, the reveal of the opponent's pieces).
- AI opponent.
- Loading / replaying a saved game (the data model anticipates it; the feature
  is not built).
- Saved formation templates / presets.
- Any networking or non-local multiplayer.
- Drag-and-drop placement (click-to-place only for now).

## Manual-verification gates

These are hard stops: the implementation pauses for the owner to run the app
and confirm behavior that automated tests cannot fully judge. All five are
hard gates.

- **Gate A — Board geometry & terrain.** From a player's perspective: 4
  interactive home rows plus the greyed, non-interactive buffer row and first
  lake sliver. Lakes match `O L L O O L L O O L L O` (three 2×2 lakes).
  Orientation and greying look right.
- **Gate B — Tray, inventory & initial placement.** Every piece type shows with
  the correct count, rendered with the real icons on the board background.
  Click-to-select then click-to-place works and counts decrement. (This gate
  also confirms the inventory counts in practice against the ruleset. It is the
  guts of the story and the most likely place for "does it feel right"
  feedback.)
- **Gate C — Interacting with placed pieces.** Move, swap, return-to-tray, and
  clear-all all behave correctly.
- **Gate D — Completion of setup.** Completeness gating (Confirm disabled until
  full; progress accurate), auto-fill (fills only empty home squares, never
  lakes, respects counts), and the hand-off to the next player's empty board,
  flipped to their perspective, with zero trace of the previous player's
  pieces.
- **Gate E — End-to-end.** White places and confirms, then Black places and
  confirms, landing on the neutral "both armies ready" state (neither layout
  revealed), and the produced versioned initial game state is inspectable and
  correct. (This is a full run-through; it need not re-test the individual
  interactions already covered by Gates A–D.)

## Open items to resolve at plan time

- Confirm the exact per-type piece counts against the current ruleset version.
- Confirm the current ruleset version number to tag the initial-state artifact.
