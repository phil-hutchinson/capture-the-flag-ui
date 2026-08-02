# Story 00000023 — Update to rules 2.0

## Summary

The game's rules have taken a major step. The companion project published a
**major-2** rules baseline — two editions at once, **`2-0:BATTLE`** and
**`2-0:SKIRMISH`** (its story 00000034, 2026-07-30) — retiring the pre-release
`1-2:PRE-RELEASE` this app currently plays. This story makes the app play
major 2.

This is a **go-forward replacement, not an addition.** The game is still
pre-release and there isn't enough of a recorded-game library to justify
carrying the old rules forward, so the owner authorizes the standing exception
again: games recorded under `1-2:PRE-RELEASE` (the old `1.2:PRE-RELEASE` tag)
need not remain reviewable. The major-1 rule code is replaced, not kept beside
the new code.

Three things change the game itself:

- **Diagonal attacks.** A piece may now attack an enemy standing one square
  **diagonally** — but only to _attack_, never to move onto an empty diagonal
  square, and only against a **movable (numbered)** piece. Towers and the Flag
  can never be attacked diagonally, so **the Flag can still only be captured
  from an orthogonally adjacent square.**
- **A second, smaller game — Skirmish.** Alongside the 12×12, 25-piece **Battle**
  game (the one this app plays today), there is now **Skirmish**: an **8×8**
  board with a **16-piece** army (three each of ranks 1–4, three Towers, one
  Flag), three home rows a side, two lake rows, and **no neutral buffer** — the
  armies start closer together. Skirmish is the recommended game for a new
  player.
- **You choose which game to play.** Starting a game now begins with a choice
  between **Battle** and **Skirmish**, with **Skirmish pre-selected** as the
  gentler introduction the first time you play; after that, the choice screen
  pre-selects whichever game you played most recently.

What else a player will notice:

- **Playing against the computer is temporarily unavailable.** The trained
  engine has to be respecified for the new rules before it can come back; until
  then that option is shown but disabled, with a short note saying so.

## Background & references

- `doc/ruleset/rules.md` in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository is the single source of truth and is not restated here. This story
  is written against **major 2**, editions `2-0:BATTLE` and `2-0:SKIRMISH` (see
  that repo's `doc/ruleset/changelog.md`, entry for story 00000034, 2026-07-30).
- `doc/ruleset/technical-notes.md` there documents the details this story leans
  on: the **editions-and-flags** model (an edition is a major baseline plus a
  complete set of flag values; the two published editions differ only in the
  `BOARD_LAYOUT` and `ARMY_COMPOSITION` flags), the now **size-parametric**
  record notation (board dimensions are read from the record's position block,
  lake layout from its `XXX` cells; the home-zone row count is _not_ in the
  block and comes from `BOARD_LAYOUT`), the **lake-corner** ruling for diagonal
  attacks (a diagonal may pass the _corner_ of a lake — the "skirt"; the
  "squeeze" between two lakes cannot arise on either published board), and the
  `Ruleset` record tag, which is now the full **edition id** (e.g.
  `2-0:SKIRMISH`), with both published editions rendering with **no deviating
  flags**.
- **This is the notation-breaking change** the technical notes call out: any
  consumer that assumed a fixed 12×12 grid must now read the board's dimensions
  from the record. This app is exactly such a consumer.
- The current rule code lives in `src/rules/primary/v1/` and is **hardcoded to
  12×12**: `board.ts` fixes `Column` to the literal union `A`–`L` and `Row` to
  `1`–`12`, and `movement.ts`, `boardView.ts`, and `encoding/eng-nn-1/shared.ts`
  are all built on those types. Making the board a parameter — not a constant —
  is the core of this work.

## Policy (fixed by the owner, 2026-07-30)

- **Replace, don't version-alongside.** The rules are implemented as major 2;
  no major-1 logic is kept, and `1-2:PRE-RELEASE` (`1.2:PRE-RELEASE`) records
  will not remain reviewable. The "recorded games stay reviewable forever"
  principle stays suspended while the game is pre-release. There are **no
  compatibility shims and no dead major-1 code retained.**
- **One code folder per major.** Following story 00000016's convention, the
  rules module for major 2 is a **new folder `src/rules/primary/v2/`**; the
  `v1` folder is removed. (Minors within a major stay on the same code; a major
  bump is a new folder.)
- **The app implements the major-2 baseline, parameterized by edition.** Rather
  than two rule engines, there is one, driven by an edition configuration —
  `BOARD_LAYOUT` (`standard_144` | `standard_64`) and `ARMY_COMPOSITION`
  (`standard_battle` | `standard_skirmish`). Both active editions ship this
  story. The board and army are **data read from the chosen edition**, not
  constants.
- **The `Ruleset` tag is the full edition id.** Records are written and read as
  `2-0:BATTLE` / `2-0:SKIRMISH`, with **no deviating flags** (each edition sets
  both flags explicitly, so a flag at its resolved value is omitted). A bare
  ruleset name is never written.
- **Per-game ruleset choice, default Skirmish.** Starting a game offers Battle
  or Skirmish, with Skirmish pre-selected as the recommended first game.
  **Amended 2026-08-01:** on owner feedback at Step 7's manual gate, the
  pre-selection only defaults to Skirmish when nothing has been played yet
  this session; after that, the picker pre-selects whichever game was played
  most recently (Battle after a Battle game, Skirmish after a Skirmish one).
  See the plan's Step 7 Notes.
- **Computer play is left broken, visibly.** The start-screen option is shown
  but **disabled with a plain-language note**; the trained-engine machinery
  (`src/engine/`) and the network encoding (`src/encoding/eng-nn-1/`) are
  knowingly left non-functional under the new rules — re-enabling them needs a
  new engine spec, which is out of scope. **This is an accepted result of the
  story.**
- **Split delivery.** This is the core story: the rules, both boards, diagonal
  attacks, the per-game choice, hot-seat play end to end, and records that
  round-trip. The fuller two-edition _experience_ and verification of the
  reviewer against **real** engine-produced 2.0 records are a **follow-up**
  (`doc/plan/proposed-stories/rules-2-0-edition-experience-and-records.md`),
  mirroring how story 00000017 followed 00000016.

## Players and colors

Unchanged: first player = White = red (`#a13d2b`); second player = Black = blue
(`#33526b`). Player-facing surfaces name the sides by color, use the rules'
piece names exactly as written there, and use the word "move" (never "ply").
The two games are named to players exactly as the rules name them — **Battle**
and **Skirmish**.

## In scope

1. **The edition model.** A small configuration describes an edition: its
   `BOARD_LAYOUT` and `ARMY_COMPOSITION` values, and everything derivable from
   them (board dimensions, lake layout, home-zone depth, and the army roster).
   The two active editions `2-0:BATTLE` and `2-0:SKIRMISH` are defined from it.
   Combinations that cannot be played (an army that does not fit its home zone,
   e.g. the Battle army on the Skirmish board) are simply not offered for play.
2. **A parametric board.** Board geometry stops being the fixed 12×12 literal
   type and instead reads its dimensions and lake pattern from the chosen
   edition. Columns are lettered from `A` and rows numbered from `1` as before
   (up to 26 columns). **Skirmish** is 8×8 — three home rows a side, two lake
   rows, **no neutral buffer**, two 2×2 lakes (`O L L O O L L O`); **Battle** is
   the existing 12×12 layout. Everything built on the old fixed types
   (`boardView.ts`, movement, the record's position block) is reworked to the
   parametric board.
3. **The per-edition army.** The piece catalog/inventory is driven by
   `ARMY_COMPOSITION`: **Skirmish** fields 16 pieces (three each of ranks 1–4,
   three Towers, one Flag — no Foot Soldier or Militia); **Battle** keeps its 25.
   Renames and rank codes are unchanged from major 1. The position-block symbol
   set is unchanged (`1`–`6`, `T`, `F`); Skirmish simply never uses `5`/`6`.
4. **Diagonal attacks.** A mobile piece may attack a **movable** enemy piece one
   square diagonally, resolving combat by the ordinary rules (rank, equal rank,
   formation bonus — none depends on direction). Constraints, per rules.md:
   **one square only** (there is no two-square diagonal, and a piece with an
   enemy on its diagonal is encumbered anyway); **movable targets only** —
   Towers and the Flag may **not** be attacked diagonally; **no diagonal move
   without an attack** — a piece may never step diagonally onto an empty square.
   A **lake corner does not block** a diagonal attack (the "skirt"): only the
   attacked square itself must not be a lake. The board's highlighting offers
   diagonal attacks as **attacks**, kept distinct from plain moves exactly as
   the orthogonal ones are.
5. **The rest of movement, combat, and endings — major 2 as written.** The
   orthogonal one-square step and the unencumbered two-square straight move are
   unchanged from major 1; combat (lower rank wins, equal ranks trade, formation
   bonus, any piece trades with a Tower) is unchanged; the single shared
   inactivity counter still draws at 50. Encumbrance already considers all eight
   surrounding squares, so diagonal enemies fold in naturally.
6. **Choosing a game.** Starting a game (hot-seat) begins with a Battle/Skirmish
   choice, Skirmish pre-selected. The chosen edition drives the whole game:
   placement, play, board rendering, and the record.
7. **Placement on both boards.** The existing tray-and-board placement flow
   works on the 8×8 and 12×12 boards alike — the army fills any of the chosen
   squares in the home zone, empty home squares are normal, and the "no two
   Towers adjacent (including diagonally)" rule is enforced as today. The
   cropped active-player placement view adapts to Skirmish's no-buffer layout.
8. **Records.** The record writer emits the edition-id `Ruleset` tag and a
   size-parametric position block for whichever edition was played; the reader
   dispatches on the edition id and round-trips both editions, recovering the
   board dimensions from the position block. Diagonal attacks need **no**
   notation change — a diagonal attack is a source and a destination like any
   other move.
9. **Computer play disabled.** The start screen shows "Play against the
   computer" disabled, with a short note that it is temporarily unavailable
   under the new rules. The engine and encoding modules are left as-is
   (non-functional), not deleted.
10. **The app works at every step, accessibly.** A hot-seat game — choose a
    game, place, play, end, dump the record — is playable throughout the story,
    each step verified and committed per the standard pipeline. Announcements,
    labels, and instructions keep pace with the ruleset choice, the second
    board, and diagonal attacks, preserving the established keyboard and
    screen-reader patterns.

## Design decisions & constraints

- **No compatibility shims, no flags smuggled in.** The rules are implemented
  directly for major 2; there is no toggle back to major 1 and no dead major-1
  code retained. The `BOARD_LAYOUT`/`ARMY_COMPOSITION` values are edition
  configuration, not a general flags/variants framework — nothing beyond the two
  published editions is offered.
- **`src/rules/primary/v2/` is the new home; `v1` is removed.** Consumers
  (`boardView.ts`, the encoding module, `readRecord.ts`, the placement and play
  sessions) move to `v2`. `readRecord.ts` dispatches on the edition id and no
  longer knows the `1.2:PRE-RELEASE` tag.
- **The board is data.** One rule engine, parameterized — not a Battle engine
  and a Skirmish engine. This keeps the two editions provably the same rules
  differing only in board and army, which is what the editions model asserts.
- **The diagonal "squeeze" is not implemented as a special case.** A diagonal
  slipping between _two_ lakes cannot arise on either published board, so the
  only rule enforced is "the attacked square is not a lake" (which permits the
  corner skirt). This matches the companion `technical-notes.md`, which reserves
  the squeeze for a future layout that can reach it.
- **The engine and encoding are knowingly broken.** `src/engine/` and
  `src/encoding/eng-nn-1/` will not function under major 2 (the encoder is built
  on the fixed 12×12 board and the 25-piece roster). They are left in place,
  unreferenced by any live path, pending a new engine spec. Their tests may be
  skipped or removed as the plan decides, but no attempt is made to make them
  correct here.
- **Player-facing text** follows rules.md's names and vocabulary and the word
  "move"; the new concepts a player meets — the two games, diagonal attacks —
  are described in plain words, not rulebook jargon (no "edition", "flag",
  "ply").

## Out of scope

- **The designed two-edition experience** — richer presentation of the
  Battle/Skirmish choice, and placement comfort tuned per board (e.g. Skirmish's
  tighter, buffer-less view) beyond minimal correctness (follow-up story).
- **Verifying the reviewer against real engine-produced 2.0 records** for both
  editions, and refreshing the sample-record tests with real engine output —
  needs records generated from the companion repo, which this container cannot
  produce (follow-up story).
- **Re-enabling computer play**: a new engine spec, re-encoding, and retraining
  are all out of scope; the option stays disabled.
- **Saving a played game to a file** and ~~**switching this app's emitted record
  to the extended notation**~~ — the standing backburner pair, still deferred.
  **Amended 2026-08-01:** the owner brought the **extended notation** half into
  scope during Step 8's manual gate, on learning that without it the app can
  never re-read a record of its own played game (the reviewer rejects the plain
  form), which made the story's own Gate D unsatisfiable. See the plan's Step
  8a. **Saving a played game to a file** remains out of scope.
- **Any major-1 compatibility**: reading, replaying, or converting
  `1.2:PRE-RELEASE` records.
- **Mid-game-start records** (format-reserved in the companion notes, not
  produced by the reference engine) — documented there, unused here.

## Manual-verification gates

- **Gate A — Choosing a game, and Skirmish placement.** Starting a game offers
  Battle and Skirmish with Skirmish pre-selected. Choosing Skirmish presents the
  8×8 board with no buffer row, the 16-piece army in the tray, and placement onto
  any home squares the player picks; the Tower-adjacency rule still blocks
  finishing (including diagonally) with a message a player can act on. The reveal
  shows both 16-piece armies correctly.
- **Gate B — Diagonal attacks.** A piece with a movable enemy one square
  diagonally is offered that square **as an attack**, and taking it resolves
  combat correctly (a stronger piece wins, equal ranks trade, a formation-bonus
  draw applies just as orthogonally). A Tower or the Flag one square diagonally
  is **not** offered as a target. No piece is ever offered a diagonal move onto
  an empty square. The lake-corner skirt is attackable where the geometry allows.
- **Gate C — Battle still plays.** Choosing Battle presents the unchanged 12×12
  game; placement, movement (including the two-square unencumbered move), and
  combat behave as before, now with diagonal attacks available.
- **Gate D — Endings and the record.** In each edition, Flag capture ends the
  game with the right winner; a long maneuvering sequence draws at the 50th quiet
  move; draw by agreement still works. The developer record dump carries the
  right edition id (`2-0:BATTLE` / `2-0:SKIRMISH`), a size-correct position
  block, and a plausible result and reason — and re-importing that dump into the
  reviewer replays it end to end.
- **Gate E — Accessibility.** With the mouse put away, the Battle/Skirmish
  choice, placement (including recovering from the Tower rule) on the Skirmish
  board, and a stretch of play including a diagonal attack are workable by
  keyboard alone, with the screen reader announcing the choice, the new board,
  and diagonal attacks correctly.
- **Gate F — Computer play and review.** "Play against the computer" is visible
  but disabled with a note explaining it is temporarily unavailable; the option
  cannot be activated. "Review a game" still opens the import screen.

## Open items to resolve at plan time

Presentation and structure only — the policy above is fixed:

- The exact shape of the edition configuration and the parametric board
  representation (how dimensions, lake layout, and home-zone depth are expressed
  and threaded), and how `boardView.ts` crops the Skirmish no-buffer view for the
  active-player placement screen.
- Confirm the diagonal-attack edge cases against the reference engine and rules
  text (skirt allowed; squeeze unreachable; movable-target-only; no empty
  diagonal step; encumbrance judged before the move).
- Confirm the size-parametric position-block format and the edition-id `Ruleset`
  tag exactly against `technical-notes.md` as it stands at plan time, including
  that both editions render with no deviating flags.
- The step decomposition that keeps the app green at every commit — likely: the
  edition/config model and the parametric board first, then the per-edition
  army, then diagonal attacks, then the Battle/Skirmish picker with placement and
  play on both boards, then records, then disabling computer play and pruning the
  `v1` folder.
- Where the Battle/Skirmish choice lives (a step before placement vs. an
  expansion of the start screen) and how it is announced and defaulted.
- Whether any existing UI copy, instructions, or help text assumes a single
  fixed board or 25-piece army and needs rewording beyond the mechanical change.
- What becomes of the `src/engine/` and `src/encoding/eng-nn-1/` test suites
  while those modules are non-functional (skip, quarantine, or remove), such that
  the project's checks stay green without pretending the engine works.
