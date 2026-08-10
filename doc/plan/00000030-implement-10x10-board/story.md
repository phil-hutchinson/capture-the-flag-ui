# Story 00000030 — Implement 10x10 board

## Summary

The companion project has **proposed** a third board and a third army to go
with it — `BOARD_LAYOUT=asymmetric_100` (a 10 × 10 board) and
`ARMY_COMPOSITION=standard_clash` (a 20-piece army) — and has implemented
neither. They sit in that repository's `doc/ruleset/proposed-variants.md`
sandbox, where a rule can be specified in full and argued over before anything
commits to it. The pair is co-designed and only meaningful together; the
proposal names the combination **Clash**, alongside Battle and Skirmish.

**This app becomes the testing ground for it,** exactly as story 00000027 made
it the testing ground for the two proposed diagonal-attack flags. A player
starting a hot-seat game picks Clash the way they already pick Battle or
Skirmish, and plays a real game on it — so the companion project can judge a
non-uniform, non-symmetric lake pattern and a mid-size board on evidence from
across a board rather than on paper.

What a player will notice:

- **A third game on the new-game screen**, named **Clash**, sitting between
  Skirmish and Battle — which is where it belongs by size. It is offered in
  exactly the same plain language as the other two, with no "experimental" or
  "proposed" framing, in keeping with how this app already presents the
  diagonal-attack choices. Everything here is pre-release; all of it gets
  equal billing.
- **A 10 × 10 board that does not look like the other two.** Battle and
  Skirmish both have tidy, mirror-symmetric 2 × 2 lakes and are open at both
  edges. Clash has lake blocks of three different widths, a lake hard against
  the left edge with **no lane at all** on that side, and a single-column lane
  at the right edge. It is the first board in the app that a player cannot
  read by symmetry.
- **A 20-piece army over five ranks.** No Militia — the lowest rank of the
  Battle army does not appear. Three each of ranks 1–5, four Towers, and the
  Flag, filling 20 of the home zone's 30 squares.
- **Everything else is the rules a player already knows.** Placement,
  movement, combat, the formation bonus, diagonal attacks, and how a game ends
  are all untouched. Tower placement is the ordinary spacing rule — Clash has
  a buffer row between each home zone and the lakes, so the lane restriction
  Skirmish plays would close nothing here, just as it closes nothing on
  Battle.

Under the surface this is the app's first game that is **not a published
edition at all**. Story 00000027 recorded a published edition plus deviating
flags; Clash is that mechanism carrying the whole weight — the board and the
army themselves become deviations from Battle.

## Background & references

- `doc/ruleset/rules.md` in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository is the single source of truth for the rules and is not restated
  here. Nothing in the numbered rules text changes for this story: the board
  and the army are `BOARD_LAYOUT` and `ARMY_COMPOSITION` values, and both
  flags are already published in Appendix A with two values each.
- **The two new values are specified in that repository's
  `doc/ruleset/proposed-variants.md`** (its story 00000041, merged
  2026-08-07), not in `rules.md` Appendix A. That file's own terms: it carries
  no promises, entries may change or disappear, and nothing outside it may
  depend on it — the front-end player application named explicitly. A value
  graduates to Appendix A only when its implementing branch merges in that
  repository. Neither has been implemented there.
- **The published state is unchanged and stays unchanged.** Appendix A:
  `BOARD_LAYOUT` = `standard_144` | `standard_64`, default `standard_144`;
  `ARMY_COMPOSITION` = `standard_battle` | `standard_skirmish`, default
  `standard_battle`; `TOWER_PLACEMENT` = `spacing_only` |
  `spacing_and_lanes`, default `spacing_only`. Appendix B: `2-0:BATTLE` and
  `2-1:SKIRMISH` active, `2-0:SKIRMISH` superseded. This story publishes
  nothing and supersedes nothing.

### `BOARD_LAYOUT=asymmetric_100`

|           |                                                |
| --------- | ---------------------------------------------- |
| Grid      | 10 × 10                                        |
| Rows      | 3 home / 1 buffer / 2 lake / 1 buffer / 3 home |
| Home zone | 3 rows × 10 columns = 30 squares               |

Rows 1–3 are White's home zone, row 4 a buffer, rows 5–6 the lake rows, row 7
a buffer, rows 8–10 Black's home zone. The lake pattern is **identical in both
lake rows**, read across all ten columns (`O` = open, `L` = lake):

| Column | A   | B   | C   | D   | E   | F   | G   | H   | I   | J   |
| ------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|        | L   | O   | O   | L   | O   | O   | L   | L   | L   | O   |

Three lake blocks of **non-uniform width** — 1 column (A), 1 column (D), and 3
columns (G–I) — and three lanes: a 2-column lane (B–C), a 2-column lane (E–F),
and a 1-column lane at the J edge. **Column A has no lane**: unlike both
published layouts, which are open at both edges, this one has a lake at one
edge and a lane at the other. Lake and open squares still split evenly within
the lake zone — 10 lake and 10 open squares across 2 × 10 — matching the 50:50
ratio both published layouts use, just distributed unevenly.

### `ARMY_COMPOSITION=standard_clash`

| Rank | Piece          | Qty    |
| ---- | -------------- | ------ |
| 1    | Master-of-Arms | 3      |
| 2    | Champion       | 3      |
| 3    | Knight         | 3      |
| 4    | Halberdier     | 3      |
| 5    | Foot Soldier   | 3      |
| —    | Tower          | 4      |
| —    | Flag           | 1      |
|      | **Total**      | **20** |

The top five ranks; Militia (rank 6) does not appear — the one rank Battle has
and this does not. Twenty pieces in a 30-square home zone is a 66.7% fill,
close to Skirmish's 67% (16 in 24) and denser than Battle's 52% (25 in 48).

### Two things the proposal settles that this story does not need to re-derive

- **The "diagonal squeeze" stays unreachable.** That repository's
  `technical-notes.md` reserves a decision for the first layout that makes a
  diagonal attack's two flanking squares both lakes while its source and
  destination stay open, and warns that breaking the 2-wide, edge-to-edge lake
  alignment — as this layout's 1- and 3-wide blocks do — is exactly the kind
  of change that could make it reachable. The proposal works it through and
  shows it does not: because both lake rows share the identical column
  pattern, any two adjacent lake columns are lake in _both_ rows, which makes
  the diagonal's own source or destination a lake and rules the attack out
  before the squeeze question arises. This story inherits that conclusion and
  does not disturb the reserved decision.
- **No `TOWER_PLACEMENT` value is needed.** `spacing_and_lanes` exists because
  Skirmish's home zones abut the lake rows directly, putting a home square in
  the mouth of every lane. Clash has a buffer row on each side, exactly as
  Battle does, so no home square is ever in a lane's mouth. `spacing_only` —
  the default, and Battle's value — is the only sensible setting.

### Relevant code today

- `src/rules/primary/v2/boardLayout.ts` — pure geometry data keyed by
  `BOARD_LAYOUT` (`columnCount`, `rowCount`, `homeRowsPerSide`, `hasBuffer`,
  `lakeRows`, `lakeColumnIndices`), plus `rowRegion`, `lakeCells` and
  `homeZoneSize`. Story 00000023 already made this fully parametric, and
  `lakeColumnIndices` already expresses a per-column pattern applied to every
  lake row — which is precisely the shape this layout needs.
- `src/rules/primary/v2/armyComposition.ts` — per-type rosters keyed by
  `ARMY_COMPOSITION`, with `armySize` and `freshInventory` derived from a
  roster rather than fixed.
- `src/rules/primary/v2/edition.ts` — the registry. An `Edition` fixes a
  `BOARD_LAYOUT`, an `ARMY_COMPOSITION` and a `TOWER_PLACEMENT`, and resolves
  the first two into a `boardLayout` and an `army` it carries directly.
  `playableEditions()` is what the picker offers; `combinationFits` already
  guards army-against-home-zone.
- `src/rules/primary/v2/configuration.ts` — story 00000027's
  `RuleConfiguration` (an `Edition` plus every flag's resolved value),
  `configureRules`, `deviatingFlags`, `renderRulesetTag` and
  `parseRuleFlagTokens`. Its `resolvedEditionValue` currently **ignores** the
  edition and always returns the catalog default, with a comment marking
  itself as the single extension point for the day an edition states a value.
  That day is this story.
- `src/rules/primary/v2/ruleFlags.ts` — the flag catalog, holding only the two
  diagonal flags today, and the sole place any flag identifier or value string
  is spelled. `RULE_FLAG_IDS` is explicitly sorted, which the `Ruleset` tag's
  ordering depends on.
- `src/rules/readRecord.ts` — splits a `Ruleset` tag into an edition id and
  flag tokens, and resolves the board layout a record is replayed on.
- `src/board/gameNames.ts` — `gameName(edition)` and
  `boardSizeDescription(edition)`, both keyed off an `Edition`;
  `defaultGameId(lastPlayed)` returns an `EditionId`.
- `src/board/GameChoice.tsx` — the new-game screen: a `GAME_DETAIL` record
  keyed by `EditionId`, a `gameOrderRank(id)` display order, and the
  rule-choice section from story 00000027.
- `src/board/ruleChoices.ts` — the player-facing copy for the diagonal
  choices, and how a non-standard configuration is described to a reviewer.
- `src/board/HotSeatGame.tsx`, `placementSession.ts`, `playSession.ts`,
  `Board.tsx`, `FullBoard.tsx`, `PlayBoard.tsx`, `Tray.tsx` — the play
  surfaces, already threading a layout and a roster through rather than
  assuming Battle.
- `src/engine/`, `src/encoding/eng-nn-1/` — the computer player. Hardwired to
  12 × 12 (`inference.ts` tells the two output heads apart by a policy length
  of 8 × 12 × 12 = 1152) and to Battle (`EngineGame.tsx` uses `BATTLE_LAYOUT`,
  `BATTLE_ARMY` and `STANDARD_BATTLE_CONFIGURATION` throughout). Untouched by
  this story.

## Policy (fixed by the owner)

- **Clash is a third game, with equal billing.** It appears in the new-game
  screen's game picker alongside Battle and Skirmish, described in the same
  plain language, with **no** "experimental", "proposed" or "pre-release"
  marking of any kind. This matches how the diagonal-attack choices are
  already presented, and reflects that the whole game is pre-release: nothing
  on that screen is more provisional than anything else on it.
- **It sits in the natural middle position, by size.** Skirmish (8 × 8), then
  Clash (10 × 10), then Battle (12 × 12).
- **Human vs. human and review only.** Computer play stays exactly as it is —
  Battle-only, on the bundled 12 × 12 model. Clash is not offered against the
  computer, and no engine work is in scope.
- **A Clash game records as a deviation from Battle.** There is no published
  edition for Clash and this app must not invent one — edition ids are the
  companion repository's to publish and are permanent once written. Instead,
  `BOARD_LAYOUT` and `ARMY_COMPOSITION` join the app's flag catalog, and a
  Clash game stamps `2-0:BATTLE` plus the two deviating values. **The owner
  has accepted that this is messy** — the tag is long and names Battle for a
  game that is not Battle — as the right trade against claiming an unpublished
  edition id.
- **Battle and Skirmish records must not change by a single byte.** Adding two
  flags to the catalog must leave every existing record and fixture rendering
  and parsing exactly as it does today.
- **This stays in `src/rules/primary/v2/`.** No new version folder: nothing
  about major 2's rules text changes, and both new values are additions to
  existing flags whose defaults are untouched.

## Players and colors

Unchanged: first player = White = red (`#a13d2b`); second player = Black =
blue (`#33526b`). Player-facing surfaces name the sides by color, use the
rules' piece names exactly as written there, and use the word "move" (never
"ply"). The three games are named to players as **Battle**, **Skirmish** and
**Clash**.

**Flag identifiers and value labels are never shown to a player.**
`BOARD_LAYOUT=asymmetric_100` is a record tag, not UI copy. A player picking
Clash reads about a 10 × 10 board and a 20-piece army.

## In scope

1. **The board.** `asymmetric_100` as a third `BoardLayout`: 10 × 10, three
   home rows a side, a buffer row on each side, lake rows 5–6, lake columns A,
   D, G, H, I. Its geometry must fall out of the existing parametric
   functions — `rowRegion`, `lakeCells`, `homeZoneSize` — with no special
   casing for the asymmetry.
2. **The army.** `standard_clash` as a third roster: 3 each of ranks 1–5, 4
   Towers, 1 Flag, Militia at zero. `armySize` and `freshInventory` derive
   from it as they already do for the other two.
3. **`BOARD_LAYOUT` and `ARMY_COMPOSITION` become known flags.** Both join
   `ruleFlags.ts`'s catalog with all three of their values and their published
   defaults. This makes `resolvedEditionValue` do real work for the first
   time: it must resolve these two flags from the edition's own fixed values
   (so Battle resolves `standard_144`/`standard_battle` and Skirmish
   `standard_64`/`standard_skirmish`) and continue falling back to the catalog
   default only for a flag no edition states.
4. **The board and army a game is played on come from the configuration, not
   the edition.** Today every rule path reads `edition.boardLayout` and
   `edition.army`. Under this story a Clash configuration names Battle as its
   edition, so those two fields are no longer the truth about the game being
   played. The resolved layout and roster must come from the configuration,
   consistently, everywhere — placement, movement, combat, outcome, replay,
   and every play surface.
5. **Clash as a playable game.** A hot-seat game on the Clash configuration
   places, plays, ends and records end to end: the picker offers it, the tray
   holds a 20-piece army, the board renders 10 × 10 with the asymmetric lakes,
   and the game is winnable and drawable by every route the rules describe.
6. **Naming a game that is not an edition.** `gameName`,
   `boardSizeDescription` and `defaultGameId` are keyed off an `Edition`
   today, and an edition id no longer identifies a game — `2-0:BATTLE` now
   names both Battle and Clash depending on its flags. Every player-facing
   surface that names the game, pre-selects it, or announces its size must
   name Clash correctly, including after a finished game and "New game".
7. **Records: writing.** A Clash game's `Ruleset` tag is `2-0:BATTLE` followed
   by the deviating `FLAG=value` tokens in alphabetical flag order —
   `ARMY_COMPOSITION` before `BOARD_LAYOUT`, both before the diagonal flags if
   those also deviate. Battle and Skirmish games render exactly as they do
   today.
8. **Records: reading.** A record naming these flags replays on the board and
   army they name — including the board _geometry_, which the notation frame
   and the position block both depend on. Story 00000027's rule stands: an
   unrecognized flag token is carried verbatim and named to the reviewer, and
   never rejects a record; only the edition id may reject one. A record whose
   position block disagrees with the layout its flags name is the one new
   conflict this story creates and must be handled deliberately.
9. **The reviewer shows what was played.** A Clash record is identified as
   Clash while reviewing it, in plain language, not as "Battle with two
   unusual settings".
10. **Everything keeps working, accessibly.** Battle and Skirmish are
    unchanged in play, in records and in wording; Clash is equivalent by
    keyboard and screen reader to what a mouse can do, on a board whose
    asymmetry makes orientation announcements matter more than before.

## Design decisions & constraints

- **The messy stamp is a deliberate, owner-accepted trade.** `2-0:BATTLE
ARMY_COMPOSITION=standard_clash BOARD_LAYOUT=asymmetric_100` says "the
  Battle rules text, with a different board and a different army", which is
  exactly what the companion repository's configuration model means by it.
  Battle is the right base rather than Skirmish for two reasons: its values
  for both flags are the published defaults, and its `TOWER_PLACEMENT` is
  `spacing_only`, which is what Clash wants — basing on Skirmish would drag in
  `spacing_and_lanes` and need a third deviation to undo.
- **`combinationFits` is now load-bearing, not decorative.** With three board
  values and three army values there are nine combinations, most of them
  nonsense and one of them (`standard_battle` on `asymmetric_100`: 25 pieces
  in 30 squares) accidentally _valid_ by the fit test alone. Only the three
  designed pairings are offered; the fit test is the floor, not the rule.
- **The picker offers games, not editions.** `GAME_DETAIL` and
  `gameOrderRank` are keyed by `EditionId` today and cannot stay that way,
  since two of the offered games would share an id. Whatever replaces it —
  most likely a small list of offered configurations, each with its name,
  description and order — is a plan-time call, but the exhaustiveness property
  those records were written for (a new game failing to compile rather than
  silently falling into a default) is worth preserving.
- **The asymmetry is the point, so nothing may assume symmetry.** Board
  rendering, the flip-board toggle, coordinate labelling, home-zone shading
  and any announcement that describes where a square sits must be checked
  against a board that is not mirror-symmetric left-to-right and has a lake at
  one edge. Story 00000023 made the geometry parametric; this story is the
  first thing that tests whether the _presentation_ is.
- **A 1-wide lane and a 3-wide lake block are both new.** Nothing in the rules
  treats them specially, and nothing in the code should either — but they are
  the first instances of each, so anything that happens to work because every
  lake block has been exactly 2 wide will surface here.
- **Militia at zero is not new.** Skirmish already fields zero Foot Soldiers
  and zero Militia, so a roster with a type at zero is an established case;
  Clash's five-rank army needs no new handling in the tray or the catalog.
- **The default path must be untouched, and demonstrably so.** Both new values
  are additions; both flags keep their published defaults; no edition changes.
  The existing record fixtures passing unchanged is the cheapest honest
  evidence, and they should not need editing.
- **Value labels may still change.** `asymmetric_100` and `standard_clash` are
  permanent only on graduation to Appendix A. `proposed-variants.md` asks that
  they be chosen as if already permanent, so the risk is low and they are used
  as written — but they belong in `ruleFlags.ts` and nowhere else, so a rename
  stays a one-file edit.
- **"Clash" is a name from the proposal, not from the rules.** It is used as
  the player-facing game name because the proposal names it and players need
  to call it something. It carries no more weight than that.

## Out of scope

- **Computer play on Clash**, and any change to computer play at all. The
  bundled model is 12 × 12-shaped and Battle-only; a Clash-capable engine
  needs a new spec, re-encoding and retraining in the companion project.
- **Graduating either value**, publishing a `CLASH` ruleset or any edition,
  and any change to `2-0:BATTLE`, `2-1:SKIRMISH` or `2-0:SKIRMISH`. Editions
  are the companion repository's to publish; this story adds none.
- **Any further board or army value**, and any general board-editor or
  custom-layout capability. Three boards and three armies, no more.
- **Changes to the rules text's substance** — placement, movement, combat, the
  formation bonus, diagonal attacks, the notation, or the ending conditions.
- **Re-opening the diagonal-attack flags**, which are unaffected and compose
  with Clash exactly as they compose with Battle and Skirmish.
- **Saving a played game to a file**, and the follow-up items parked in
  `doc/plan/proposed-stories/rules-2-0-edition-experience-and-records.md`.

## Manual-verification gates

- **Gate A — Battle and Skirmish are unchanged.** A Battle game and a Skirmish
  game place, play and end exactly as before, and their records read
  `2-0:BATTLE` and `2-1:SKIRMISH` with no flag tokens.
- **Gate B — The Clash board is right.** Starting Clash shows a 10 × 10 board
  with columns A–J and rows 1–10; lakes at A, D, G, H and I on rows 5 and 6
  only; empty buffer rows at 4 and 7; and home zones of rows 1–3 and 8–10.
  The left edge is lake, the right edge is a 1-wide lane.
- **Gate C — The Clash army is right.** The tray holds 20 pieces — three each
  of ranks 1–5, four Towers, one Flag, no Militia — and placement is complete
  only when all 20 are down, in 20 of the 30 home squares.
- **Gate D — Tower placement.** The ordinary spacing rule applies (no two
  Towers touching, diagonals included) and nothing more: a Tower directly in
  front of a lane in row 3 or row 8 is accepted, unlike on Skirmish.
- **Gate E — A full Clash game.** A game played end to end behaves as the
  rules describe on the new geometry: movement blocked by lakes and edges,
  orthogonal and diagonal attacks, the formation bonus, and a win by Flag
  capture. The 1-wide J lane and the 3-wide G–I lake block behave like any
  other lane and lake.
- **Gate F — Records round-trip.** A finished Clash game dumps a record whose
  `Ruleset` tag reads `2-0:BATTLE ARMY_COMPOSITION=standard_clash
BOARD_LAYOUT=asymmetric_100`, and re-importing that dump into the reviewer
  replays it end to end on the 10 × 10 board, identified as Clash.
- **Gate G — The new-game screen.** Three games are offered in the order
  Skirmish, Clash, Battle, each described in plain language with no
  experimental framing; the diagonal-attack choices apply to Clash as they do
  to the other two; and returning to the screen after a Clash game
  pre-selects Clash.
- **Gate H — Accessibility.** With the mouse put away, choosing Clash,
  placing a full army, and playing a game through to a Flag capture is
  workable by keyboard alone, with the screen reader announcing squares,
  lakes and the board's edges correctly on a board that is not symmetric.

## Open items to resolve at plan time

- **How the configuration carries its board and army.** Whether
  `RuleConfiguration` gains resolved `boardLayout`/`army` fields derived from
  its flags, whether callers derive them on demand, and how the ~60 existing
  `edition.boardLayout`/`edition.army` reads are migrated without leaving a
  path that silently keeps reading the edition's own values. This is the
  story's main technical risk and the most likely source of a Clash game
  played half on one board and half on another.
- **Whether `Edition` should keep resolving a layout and a roster at all**,
  now that those fields are no longer the truth for every configuration, or
  whether it should carry only the three flag values and let the configuration
  resolve them.
- **How the picker models an offered game** — a list of named configurations,
  a derived "game id", or something else — and how `gameName`,
  `boardSizeDescription` and `defaultGameId` follow, given an edition id no
  longer identifies a game and session stickiness must survive.
- **What happens when a record's position block and its `BOARD_LAYOUT` token
  disagree** on dimensions or lake placement, and which of the two wins. The
  notation is size-parametric and the block is self-describing, so this is
  newly reachable.
- **The player-facing wording for Clash** on the picker and in the placement
  announcement, including how to describe a board whose asymmetry a player
  cannot infer from a size.
- **How a Clash record is identified to a reviewer** given its tag names
  Battle, and whether `ruleChoices.ts`'s existing "what was non-standard about
  this game" surface is the right home for it or the wrong one.
- **What test fixtures are needed** — at minimum a Clash record round-trip, a
  geometry suite for the new layout, and a canonicalization case proving
  Battle and Skirmish stamps are byte-identical to today's.
- **Whether `README.md` needs updating**, given a third game a player meets
  immediately on the new-game screen.
- **The step decomposition** that keeps the app green at every commit — likely
  the layout and roster data first, then the flag catalog and configuration
  resolution, then the migration of layout/army reads, then the picker and
  naming, then records and the reviewer.
