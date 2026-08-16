# Implementation Plan — Story 00000036: Add proposed ruleset three

This plan adds **Demotion** — a fourth playable game under a **whole new
ruleset major** — alongside Skirmish, Clash and Battle, for hot-seat play
only. It builds a new rule engine at `src/rules/primary/v3/`, leaves
`src/rules/primary/v2/` untouched byte for byte, and opens a narrow
major-agnostic seam in the shared UI so both majors can be live in the same
app at the same time.

Read `story.md` in this folder in full before starting any step. Its
**Policy (fixed by the owner)**, **In scope / Out of scope**, **Design
decisions & constraints** and **Manual-verification gates** sections are
settled and are not re-litigated here. This plan resolves the story's **"Open
items to resolve at plan time"** — the resolutions are in "Decisions resolved
at plan time" below, and every step is written assuming them.

---

## Grounding facts (read once — applies to every step)

### Where the major-3 rules are

**A pinned, verbatim snapshot of the companion project's proposed major-3
ruleset sits in `reference/` beside this plan** (companion commit `b3c3202`).
It is complete and self-contained — it does **not** require reading the
major-2 rules first — and it is the exact draft this story was written
against. Read from there and **do not fetch anything over the network**; the
companion repository may already have moved on, and this story is built
against the snapshot.

| File                           | Read it for                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `reference/rules.md`           | the complete ruleset: board, pieces, movement, combat, diagonal attacks, notation, endings |
| `reference/start-position.md`  | generation, the strength rule, the position ID                                             |
| `reference/changelog.md`       | the fastest route to _what changed_ from major 2                                           |
| `reference/technical-notes.md` | rationale only — not needed to implement anything                                          |
| `reference/SNAPSHOT.md`        | provenance; explains why the copy exists and that it is never edited                       |

Every step below names the sections it needs. **The rules are never restated
in this plan** — where a step needs a rule, it cites the section and the
implementer reads it there.

`doc/ruleset/rules.md` in the companion repository (the _published_ rules) is
unchanged by this story and is not consulted for anything major-3.

### The two silent breakages, in one line each

1. **Rank numbering is reversed and piece names are reused at different
   ranks.** At major 2 rank 1 is strongest; at major 3 rank 5 is. "Foot
   Soldier" is rank 5 at major 2 and rank **3** here; "Militia" is rank 6
   there and rank **2** here. **Key artwork and strength off the pair
   `(major, rank digit)` — never off a name, never off a digit alone.**
2. **A position ID is a 16-character string, never a `Number`.** Sixteen hex
   digits is 64 bits, past the 2⁵³ limit within which a JavaScript `Number`
   holds integers exactly, so parsing one corrupts it silently.

### The major-3 army (from `reference/rules.md` §2.2)

| Rank | Qty | Name           | ID digit |
| ---- | --- | -------------- | -------- |
| 5    | 3   | Master-of-Arms | `5`      |
| 4    | 3   | Champion       | `4`      |
| 3    | 3   | Foot Soldier   | `3`      |
| 2    | 3   | Militia        | `2`      |
| 1    | 3   | Peasant        | `1`      |
| —    | 1   | Flag           | `F`      |

**Rank 5 strongest, rank 1 weakest. No Towers — the piece type does not exist
at major 3.**

### The settled sprite mapping (owner decision, story.md)

Both majors draw from the same sheet (`src/art/pieceSprites.svg`) but are
**keyed separately**. This table is the whole of Step 10's data:

| Glyph | Major 2 sprite | Major 3 sprite           |
| ----- | -------------- | ------------------------ |
| `1`   | `p-marshal`    | `p-sapper`               |
| `2`   | `p-champion`   | `p-militia`              |
| `3`   | `p-knight`     | `p-infantry`             |
| `4`   | `p-halberdier` | `p-champion`             |
| `5`   | `p-infantry`   | `p-marshal`              |
| `6`   | `p-militia`    | _(no rank 6 at major 3)_ |
| `T`   | `p-tower`      | _(no Towers at major 3)_ |
| `F`   | `p-flag`       | `p-flag`                 |

Note what this shows: **every numeric glyph resolves to a different sprite in
the two majors.** Only `F` agrees. Sharing a drawing is fine; sharing a lookup
key is the silent breakage the companion project warns about, and this table
is why the key must carry the major.

`p-knight`, `p-halberdier` and `p-tower` are unused at major 3. `p-archer`,
`p-assassin` and `p-skirmisher` stay in the sheet unreferenced, as today.

### Where the relevant code is today

- `src/rules/primary/v2/` — the whole major-2 engine, 17 modules. **Not
  touched by any step of this story.** Read it only as a _shape_ reference for
  what a rule-engine folder contains; never copy-and-edit it.
- `src/rules/readRecord.ts` — the record reader's version dispatch. **Not
  touched** (records are out of scope).
- `src/board/` — every play surface. `FullBoard.tsx` (the accessible full
  board), `PlayBoard.tsx` (a thin `PlaySession`→`FullBoard` adapter),
  `boardView.ts` (orientation), `PlayStatus.tsx`, `GameResult.tsx`,
  `DrawOffer.tsx`, `FlipBoardToggle.tsx`, `LeaveGameDialog.tsx`,
  `playSession.ts` (the interaction state machine), `playAnnouncement.ts`
  (live-region wording), `playWarnings.ts` (the inactivity countdown),
  `gameNames.ts`, `GameChoice.tsx`, `HotSeatGame.tsx` (~1100 lines: game
  choice, then placement, then play, as three branches of one component
  sharing a persistent `<h1>` and two live regions).
- `src/board/grid/AccessibleGrid.tsx`, `gridNavigation.ts` — already
  dimension-parametric and genuinely major-agnostic. **No step changes them.**
- `src/art/PieceIcon.tsx` — takes a major-2 `PieceTypeId` and draws its sprite
  plus its position-block symbol as a corner numeral.
- `src/App.tsx` — the screen union and `lastPlayedConfiguration` (a major-2
  `RuleConfiguration` that outlives every screen change).
- `src/featureVisibility.ts` — constants only. "Play against the computer",
  "Review a game" and the developer record dump are all **hidden** today, so
  `EngineGame.tsx`, `ReviewScreen.tsx` and `GameRecord.tsx` are unreachable at
  runtime but **must keep compiling**.

### Out of bounds for every step

- **`src/rules/primary/v2/**` must not be edited at all** — not a line, not a
  comment. If a step appears to need an edit there, **stop and escalate**: it
  means the seam is in the wrong place.
- **`v3` must not import from `v2`, and `v2` must not learn about `v3`.**
  Types that look identical across the two (`Side`, `Square`, `squareKey`) are
  restated inside `v3`, not hoisted. The two majors meet **above** the rules
  layer only.
- `src/rules/readRecord.ts` and `readRecord.test.ts` — untouched. No major-3
  record reading or writing, no `recordFile.ts`/`replay.ts` for v3, no
  `[StartPosition "…"]` tag handling.
- `src/engine/**` and `src/encoding/**` — untouched. No computer-play work.
- `src/app/rules/**` (the "How to play" primer) — **copy unchanged**. The one
  permitted edit is `RuleFigure.tsx`'s mechanical `PieceIcon` prop change in
  Step 10.
- No existing record fixture, sample file, tag string or position block may be
  edited. No change to Battle, Skirmish or Clash behaviour of any kind.
- This app invents no edition id and graduates nothing. `3-0:PRE-RELEASE` is
  spelled in exactly **one** constant.
- The `2-0:CLASH` divergence (this app stamps Clash as `2-0:BATTLE` plus two
  flags) is deliberately **not** addressed here.

### The check every step runs

From the repository root:

```
npm run typecheck && npm run lint && npm test && npm run format:check && npm run build
```

All five must be clean before a step is considered done. `npm run build` is
what proves the hidden `src/engine/`, `src/encoding/`, `EngineGame.tsx` and
`ReviewScreen.tsx` trees still compile.

Steps with a **manual** verification additionally need `npm run dev`. **This
container has no file watching, so the dev server must be restarted before
observing anything** — a stale page is the single most common cause of a
manual gate appearing to fail.

---

## Decisions resolved at plan time

These resolve story.md's "Open items to resolve at plan time". Every step
below assumes them.

### 1. Where the two majors meet: a narrow major-agnostic presentation seam

The story offered (a) parallel v3 play surfaces or (b) a major-agnostic view
layer both majors adapt onto, and recommended (b). **This plan takes (b), and
puts the seam at the rendering boundary — not at the session boundary.**

Concretely, the codebase divides in three:

- **Shared and major-agnostic** (one implementation, both majors adapt onto
  it): the accessible grid, the full board renderer, board orientation, piece
  art, the turn indicator, the result panel, the draw-offer control, the
  flip-board toggle, the leave-game dialog, the inactivity-countdown wording.
  This is the thick, carefully-built, accessible code the story warns against
  duplicating — and it is the part that needs _least_ from a rules major:
  board dimensions, impassable terrain, one token per occupied square, four
  sets of squares (selected, plain-move destinations, attack targets,
  activatable), an activation callback, and some already-composed sentences.
- **Per-major and duplicated** (v2 keeps its own, v3 gets its own): the
  interaction state machine (`playSession.ts`), the live-region wording
  (`playAnnouncement.ts`), and the adapter that turns a major's board state
  into the shared view model. These are thin (a few hundred lines each) and
  deeply rules-shaped — major 3 has different legality, different endings, an
  extra declared action (resign) and a brand-new event to announce (a
  demotion). A shared abstraction over them would be a leaky union of both
  majors' vocabularies for no gain. **Duplicate the thin, rules-shaped layer;
  share the thick, rules-agnostic layer.**
- **Untouched and major-2-only**: everything about placement (`Board.tsx`,
  `Tray.tsx`, `PlacementControls.tsx`, `PlacementStatus.tsx`,
  `placementSession.ts`, `placementAnnouncement.ts`,
  `towerPlacementMessages.ts`, `boardView.ts`'s cropped `visibleRows`), the
  reviewer, and the "How to play" primer.

**What makes this cheap is a structural coincidence, and it is worth stating
plainly:** major 2's `Side` (`"white" | "black"`) and `Square`
(`{ column: string; row: number }`) are structurally identical to the ones
major 3 will declare for itself. The shared view layer therefore declares its
_own_ `ViewSide`/`ViewSquare`, and values from either major are already
assignable to them — with **no import in either direction and no edit inside
`src/rules/primary/v2/`**. The seam costs a props change and an adapter, not a
rewrite.

The shared view model lives in a new folder **`src/board/view/`** and consists
of: `ViewSide`, `ViewSquare`, a square-key helper, a `BoardGeometry` (column
count, row count, and the set of impassable square keys), a `BoardToken`
(side, piece art key, player-facing occupant label), a `BoardPosition` (tokens
keyed by square key), and the orientation helpers lifted out of `boardView.ts`
(`fullBoardRows`, `visibleColumns`, `fullBoardDisplayPosition`,
`movePathSquares`) re-expressed over a `BoardGeometry`. **It imports nothing
from `src/rules/`.**

### 2. Piece art is keyed by `(major, glyph)`, via a two-level table

`PieceIcon` stops taking a major-2 `PieceTypeId` and instead takes a
`PieceArt` value: a **major** (2 or 3) and a **glyph** (the one-character rank
digit — `1`–`6`, `T`, `F` at major 2; `1`–`5`, `F` at major 3). The sprite is
looked up in a **two-level table, one row per major** (see the Grounding
facts' table), and the glyph is _also_ what is drawn as the corner numeral. A
shared drawing can therefore never become a shared key: the two majors' rows
are separate objects, and every numeric glyph already resolves differently in
each.

Each major supplies its own exhaustive mapping into that glyph space, in its
own adapter (`Record<PieceTypeId, …>` for major 2; `Record<Rank | "flag", …>`
for major 3), so a new piece type or rank fails to compile rather than falling
into a default. **Major 2's rendered output is unchanged, sprite for sprite
and numeral for numeral** — Step 10 asserts exactly that.

### 3. A game is identified by an app-level catalog, above both majors

`GameId`, `GAME_DETAIL`, `gameOrderRank`, `gameName` and `defaultGameId` are
keyed off major 2's `GameId` today, and `App.tsx` holds a major-2
`RuleConfiguration` as its "last played" memory. This plan introduces a new,
app-level module **`src/games/gameCatalog.ts`**, above the rules layer:

- an `AppGameId` union — `"skirmish" | "clash" | "battle" | "demotion"`;
- a catalog **`Record<AppGameId, …>`** (so a fifth game fails to compile until
  it has an entry) carrying, per game: its player-facing name, its
  one-or-two-sentence description, its display order, a plain-language board
  size phrase, and its **source** — a discriminated field naming either major
  2 plus that major's own `GameId`, or major 3;
- the list of games actually offered: the catalogued major-2 games whose
  source game is in `games.ts`'s `playableGames()` (the existing
  `combinationFits` floor, unchanged), plus Demotion, which is always offered.

`App.tsx`'s session memory becomes a **`GameSelection`**: the `AppGameId` just
played plus the player's major-2 rule choices (the two diagonal-attack flag
values). For a Demotion game the rule-choice part is simply carried through
untouched, which is what makes Gate B's "selecting any other game brings the
section back with its previous selections intact" hold across a major
boundary. `defaultGameId` takes a `GameSelection | null` and still returns
Skirmish on the first game of a session.

`gameNameForConfiguration` and `reviewedGameLine` stay exactly as they are:
they answer "which game is this major-2 configuration", which is still a
major-2 question (the reviewer is major-2-only).

### 4. Demotion is displayed **last** in the picker

Order becomes Skirmish, Clash, Battle, **Demotion**. The existing order is a
gentle-to-full progression by board size _within one rules text_; Demotion is
a different rules text, so slotting it first (at 8 × 8) would put an entirely
different game ahead of the game story.md calls "the recommended game for a
new player" and change what a first-time viewer meets first. Appending it
leaves all three existing entries in their settled positions, which is also
what makes Gate A's "nothing else changed" cheap to confirm. Skirmish remains
the first-game-of-a-session pre-selection.

### 5. `GameResult` becomes presentational; each major composes its own result sentence

`GameResult.tsx` currently calls major 2's `describeResult` itself. It instead
takes an already-composed **summary sentence**, plus the outcome kind and the
winning side for its `data-` attributes and styling. Each major's own
announcement module composes the sentence, so the panel and the live region
still say the same words, and no shared union of both majors' end reasons has
to be invented. Major 2's callers pass `playAnnouncement.ts`'s
`describeResult(...)` and are word-for-word unchanged.

Demotion's six result sentences are fixed here, in player-facing wording
(colors, never "White"/"Black"; "move", never "ply"):

| Ending           | Sentence                                                   |
| ---------------- | ---------------------------------------------------------- |
| Flag capture     | `Red wins — Flag captured.`                                |
| Attrition        | `Blue wins — Red has no pieces left.`                      |
| Mutual attrition | `The game is a draw — neither player has any pieces left.` |
| Inactivity       | `The game is a draw — by inactivity.`                      |
| Resignation      | `Blue wins — Red resigned.`                                |
| Agreement        | `The game is a draw — by agreement.`                       |

### 6. A demotion is announced in words, and shown by the artwork itself

The attack sentence for a Demotion game names the survivor's **new** rank
explicitly and in full — e.g. _"Red Champion attacked Blue Foot Soldier at D5:
Blue Foot Soldier falls, Red Champion advances and is demoted to Foot Soldier,
rank 3. Blue to move."_ — and the same for a surviving **defender**. On the
board itself the change is conveyed two ways with no new UI: the corner
numeral changes, and **the artwork changes too**, because art is keyed by rank
and a demoted rank 5 is drawn as a rank 4 from that moment on. The square's
accessible label always names the piece's _current_ rank, so re-reading the
square confirms it.

### 7. The starting position uses an injectable source of randomness

Generation takes an optional random source, defaulting to `Math.random`, so
tests can drive it deterministically with a tiny seeded generator declared in
the test file (**no new dependency**). Each new game generates afresh; there
is no "replay this position" feature to make it reproducible for. Generation
places the Flag uniformly on row 1 and shuffles the 15 numbered pieces
uniformly into the remaining 15 squares (`reference/start-position.md` §2) —
**never by drawing a random position ID**, which is ruled out explicitly.
Mirror-equivalent positions are **not** collapsed.

### 8. The position ID is implemented but **not shown to a player**

Encoding, decoding and validation are in scope (story.md, in-scope item 1) and
fully unit-tested, and a generated position carries its own ID in the game
state. Nothing renders it: the rules call it optional, its player-facing use
is replaying or mirroring a position, and this app can do neither yet. Records
are out of scope, so it is written nowhere either. It is a string throughout —
**no `Number` anywhere near it**.

### 9. Resigning is a two-step control of its own, beside the draw offer

A `ResignControl` component sits next to `DrawOffer`, **rendered only for a
Demotion game** (major 2 has no resignation). First press shows an inline
confirmation — _"Resign the game? Blue wins immediately. This can't be
undone."_ — with **Resign** and **Cancel** buttons, focus moving to **Cancel**
(the harmless option, following `DrawOffer.tsx`'s and `LeaveGameDialog.tsx`'s
established precedent). The confirmation is the resigning player's own guard
and must never be worded as the opponent accepting: a resignation needs no
acceptance and cannot be declined. The control is available to the player to
move at any point while the game is ongoing, and is hidden while a draw offer
is awaiting an answer (the offer must be answered first — the board is already
inert in that state).

### 10. The inactivity countdown is parameterized, not duplicated

`playWarnings.ts` stops taking a major-2 `PlayState` and instead takes the
three things it actually uses: whether the game is ongoing, the current
inactivity counter, and the **limit**. Major 2 passes its own
`INACTIVITY_LIMIT` (50); Demotion passes 40. One wording, two limits, no
duplicated sentence. The 10-moves-remaining warning threshold is unchanged.

### 11. `HotSeatGame` gains a fourth branch inside the same shell

A Demotion game starts at what is currently `HotSeatGame`'s _second_ branch:
game choice, then straight into play. `HotSeatGame` keeps ownership of the
picker and of the screen shell — `<main>`, the persistent `<h1>` with its
focus ref, "Back to start", `LeaveGameDialog`, and the game-announcement live
region — and, when the chosen game's major is 3, renders a new
**`DemotionGame`** component in place of the placement/play branches.

**The shell's element order must be identical in the new branch to the other
three** (sprite defs, heading, back button, leave dialog, announcement region,
then content), so React keeps one persistent `<h1>` node and one persistent
`role="status"` region across every branch change — the property story
00000002's Step 5 and Step 7 established, and the reason the opening
announcement is heard at all. The existing effect that refocuses the heading
when a game is chosen must fire for Demotion exactly as it does for the other
three.

The opening announcement is set in the same handler that starts the game, into
the already-registered game-announcement region: _"You chose Demotion. Playing
on an 8x8 board. Both armies are already on the board — there is nothing to
place. Red to move."_

`LeaveGameDialog`'s wording ("Leave this game? The game in progress will be
lost. This can't be undone.") **fits unchanged** — it never mentions placement.

### 12. `GameRecord` (the developer dump) is not wired to Demotion

`GameRecord.tsx` takes a major-2 `PlayState` and is hidden behind
`SHOW_DEVELOPER_GAME_RECORD` anyway. A Demotion game does not render it.
Story.md's in-scope item 11 is satisfied where it actually bites: **v3 stores
every move in the extended form (`x` and `=N`) at the moment it is applied**,
so the record text is already correct for whichever follow-up story surfaces
it. The simplified `A2A4` form is never produced anywhere.

### 13. Engine test coverage, minimum bar

Story.md lists the coverage the engine needs; it is distributed across Steps
1–9 and every item is named in a step's verification. The bar: generation
uniformity and the flag-on-row-1 restriction; both branches of the strength
rule and the exact `S = 21`/`S = 22` boundary; position ID round-trip and each
validation rejection; direction-relative encumbrance in all four directions;
open-path diagonals including the Flag; rank reduction on attacker and on
defender; rank reduction stopping at rank 1; the formation bonus recomputed
after a demotion; and every ending condition including mutual attrition.

---

## Step 1 — Major-3 foundations: board, pieces, edition id

Status: committed

Notes: Created `src/rules/primary/v3/board.ts`, `pieces.ts`, `edition.ts` and
their tests, written from `reference/rules.md` §2 and §4.5 alone (v2 was read
only for folder shape/comment style, per the plan). `board.ts` adds a
`Direction`/`stepFrom` primitive beyond the plan's explicit list (a "bounded
single-step helper for adjacency arithmetic") to give Steps 5–7 (encumbrance,
diagonal open-path, formation bonus) one shared adjacency function instead of
each reinventing offsets — a reasonable reading of that line, not a deviation
in scope. One deviation from a literal reading of the verification text: to
get a true one-hit grep for the edition literal and a true zero-hit grep for
`primary/v2`, module comments were written to _describe_ those facts without
_spelling_ the literal strings (e.g. "the existing major-2 rule engine" instead
of quoting the path); `edition.test.ts` still asserts the literal
`3-0:PRE-RELEASE` twice, which is necessary for the test to be a real guard
rather than a tautology — so the "one hit" grep is exactly one hit in
production source (`edition.ts`) plus two in its own test file. All five
checks and both greps pass as run.

Create `src/rules/primary/v3/` with its first three modules, written **from
`reference/rules.md` §2 and §4.5 alone** — not by copying and editing anything
in `src/rules/primary/v2/`.

- `board.ts` — the fixed 8 × 8 geometry: `Side` (`"white" | "black"`), a
  side-flip helper, `Square` (column letter + row number), a stable square-key
  helper, the column letters A–H and rows 1–8, the full square list, a
  column-index helper, a bounded single-step helper for adjacency arithmetic,
  White's home rows (1–2) and Black's (7–8), and the left half (A–D) / right
  half (E–H) split. **Every square is open** — there is no terrain concept at
  this major, and no `BoardLayout` parameter anywhere: the board is fixed.
- `pieces.ts` — the five ranks (5 strongest, 1 weakest), the Flag, their
  player-facing names, their one-character ID digits, and the army
  composition (three of each rank plus one Flag = 16). The module comment must
  record, in the rules' own words, that **the number is the rule and the name
  is decoration**, and that rank numbering runs the _opposite_ way to major 2.
- `edition.ts` — the edition id `3-0:PRE-RELEASE` as **one exported constant**,
  and the `Ruleset` tag value derived from it (a bare edition id: major 3
  publishes no rule settings, so there are never any deviating tokens). The
  comment must say that `PRE-RELEASE` is a working name that may change, which
  is why it is spelled once.

There is **no** `configuration.ts`, no `games.ts`, no flag catalog and no
`boardLayout.ts` in this folder, and there never will be: major 3 has no rule
settings for them to vary.

Why it comes here: everything else in the v3 engine sits on these three
modules, and they touch no existing behaviour, so this is a safe first commit.

Verification (**automated**): new `board.test.ts`, `pieces.test.ts` and
`edition.test.ts` under `src/rules/primary/v3/`. The board reports 8 columns
(A–H) and 8 rows, 64 squares, White's home rows as 1–2 and Black's as 7–8,
each half as four columns and each side's home area as 16 squares — exactly
one army; the step helper stays on the board at every edge. The piece catalog
totals 16 pieces, three of each rank, one Flag, with rank 5 named
Master-of-Arms and rank 1 named Peasant, and each rank's ID digit equal to its
own number. The edition constant is exactly `3-0:PRE-RELEASE` and appears in
exactly one place (grep the v3 folder for the literal — one hit). Also grep
the new folder for `primary/v2` — **zero hits** — and run the five repository
checks.

---

## Step 2 — The major-3 position: rank as mutable game state

Status: committed

Notes: Created `src/rules/primary/v3/position.ts` and `position.test.ts`.
`PlacedPiece` is a discriminated union (`NumberedPiece` carrying a mutable
`rank`, or `FlagPiece` with none), stored in a plain `PositionState` record
keyed by `squareKey` (JSON-serializable, matching major 2's `BoardState`
shape). Implemented `pieceAt`, `placePiece`, `removePiece`, `relocatePiece`,
`piecesOf`, `numberedPieceCount`, `findFlag`, `reduceRank` (clamped at rank 1,
exported for reuse by Step 7's `combat.ts`) and `demotePiece`. One addition
beyond the plan's explicit list: `squareFromKey`, a private inverse of
`board.ts`'s `squareKey`, needed so `piecesOf`/`findFlag` can return real
`Square`s from the record's string keys without duplicating that logic at
each call site or editing `board.ts` (out of scope for this step) — a small,
private implementation detail, not a new public surface. All five checks
pass; grep of `src/rules/primary/v3/` for `primary/v2` is zero hits; `git
status` shows no modification under `src/rules/primary/v2/`.

Add `src/rules/primary/v3/position.ts`: the board-state model in which **a
piece on the board is a side plus a _current_ rank**, not a fixed token
identity.

It holds: a placed piece (a side, and either a ranked piece carrying its
current rank or the Flag); a board state keyed by square key, with absent keys
meaning empty; and pure helpers to read a square, place, remove and relocate a
piece, list a side's pieces, count a side's **numbered** pieces (the Flag never
counts), find a side's Flag, and **demote** a piece by one rank.

Two properties this module owns:

- **Demotion clamps at rank 1.** The rules argue a rank 1 can never survive
  combat, but the engine must not depend on that argument holding: demoting a
  rank 1 yields a rank 1, never a rank 0 propagating through the board state
  (owner decision, story.md).
- **Nothing treats rank as a fixed property of a token.** There is no piece
  identity, no id, and no "original rank" field anywhere — a demotion is
  simply a different value at that square.

The board state must be plain, JSON-serializable data (no `Map`s, no
functions), matching the shape major 2 uses.

Why it comes here: every later v3 module — generation, movement, combat,
outcome, play — reads and writes this state, and rank mutability is the
story's deepest new idea, so it is established once, on its own, before
anything depends on it.

Verification (**automated**): new `position.test.ts`. Placing, reading,
removing and relocating round-trip; the numbered-piece count for a side
excludes its Flag and reaches zero when only the Flag remains; demoting a rank
5 yields a rank 4 and demoting a rank 1 yields a rank 1; demoting leaves every
other square untouched; a state survives `JSON.parse(JSON.stringify(...))`
unchanged. Run the five repository checks.

---

## Step 3 — The position ID: encode, decode, validate — as a string

Status: committed

Notes: Created `src/rules/primary/v3/positionId.ts` and `positionId.test.ts`.
`encodePositionId`/`decodePositionId` use `board.ts`'s `homeSquares("white")`
directly for the fixed row-1-then-row-2 order (its iteration order already
matches the spec exactly, so no new ordering logic was needed); decoding
throws only on the wrong length or a digit with no meaning at this major (the
reserved `6`-`E` range), while `isValidPositionId` is the separate, stricter
check (length, exact rank/Flag counts, Flag in the first eight characters),
per the plan's "decoding and validating are different operations." One
deviation, matching the precedent Step 1 already set: to get a true zero-hit
grep for `Number(`/`parseInt`/`parseFloat`/`BigInt`, the module comment
explains the "never a `Number`" rule in prose without spelling those
identifiers literally (e.g. "never converts a code to a number, a big
integer, or anything else numeric") rather than quoting them as banned
tokens. All five checks pass; the `Number(`/`parseInt`/`parseFloat`/`BigInt`
grep and the `primary/v2` grep are both zero hits; `git status` shows no
modification under `src/rules/primary/v2/`.

Add `src/rules/primary/v3/positionId.ts`, implementing
`reference/start-position.md` §5.

Encoding reads White's 16 squares in the fixed order — **row 1 A→H, then row 2
A→H** — writing one uppercase hexadecimal character per square (a rank digit,
`F` for the Flag, `0` for empty). Decoding is the inverse, producing White's
half of a board state. Validation is **separate from decoding** and is what
decides whether a code names a legal major-3 starting position: exactly 16
characters, exactly three each of `1`–`5`, exactly one `F`, and that `F` among
the first eight characters. A lowercase code is normalised to uppercase before
anything else is done with it.

**It is a string throughout.** No `Number`, no `parseInt`, no arithmetic on
the code, anywhere — comparison is string comparison. The module comment must
say why (64 bits, past the 2⁵³ exact-integer limit, and this is a front-end
repository), and must state that a position is **never** generated by drawing
a random code (the encoding is roughly 7 × 10⁻¹¹ dense).

Why it comes here: Step 4 encodes each position it generates, and expressing
the generated arrangement as a code is by far the most readable way to write
the generator's own tests.

Verification (**automated**): new `positionId.test.ts`. Round-trip: encoding
a decoded code returns the identical string, for several codes including the
example `2542333F54415211` from `reference/start-position.md` §5 and both
endpoints `1112223F33444555` and `F555444333222111`. Validation **rejects**
each of: a 15-character code, a 17-character code, a code with two `F`s, a
code with no `F`, a code whose `F` is in the last eight characters, a code
with four of one rank and two of another, and a code containing a reserved
digit (`0`, `6`–`E`). A lowercase code validates and normalises to the
uppercase form and compares equal to it as a string. Grep the module for
`Number(`, `parseInt`, `parseFloat` and `BigInt` — **zero hits**. Run the five
repository checks.

---

## Step 4 — Generating a starting position, and the derived strength rule

Status: committed

Notes: Created `src/rules/primary/v3/startPosition.ts` and
`startPosition.test.ts`. `generateWhiteArrangement` places the Flag via a
uniform column draw on row 1, then Fisher-Yates-shuffles the 15-piece rank
multiset into the remaining squares, both driven by an injectable
`RandomSource` (default `Math.random`); `deriveBlackArrangement` takes
White's arrangement alone (no randomness) and computes the branch via
`isHalfTurn`, whose comparison (`S * NUMBERED_PIECE_COUNT_PER_SIDE >
PIECES_IN_FLAG_HALF * TOTAL_RANK`) is built from `pieces.ts`/`board.ts`
constants rather than a literal `22`; `generateStartPosition` composes the
two and encodes White's arrangement into the position ID. Mirror-equivalence
is not referenced or acted on anywhere in the module, per §4. Test file
declares a small `mulberry32`-style seeded `RandomSource` (no dependency
added) and covers shape, uniformity (flag on all 8 row-1 columns and every
rank on all 16 White squares over a 4000-sample draw), the exact `S = 21`/`S
= 22` boundary via hand-built arrangements (with full square-by-square
mapping checks for both branches), an independent recomputation of the
threshold from the army data (asserted to equal 21), both branches occurring
over a sample, the 8-piece-on-row-2 opening invariant, and a position-ID
sanity check. No deviations from the plan. All five checks pass; the
`primary/v2` grep under `src/rules/primary/v3/` is zero hits; `git status`
shows no modification under `src/rules/primary/v2/`.

Add `src/rules/primary/v3/startPosition.ts`, implementing
`reference/rules.md` §3 and `reference/start-position.md` §§1–3.

White's arrangement is drawn **uniformly** from the constrained set: the Flag
placed uniformly on a square of row 1, then the 15 numbered pieces shuffled
uniformly into the remaining 15 squares. The random source is an **injectable
parameter defaulting to `Math.random`** (Decision 7).

Black's arrangement is then derived by turning White's, chosen by the strength
rule: sum the ranks of the seven numbered pieces in the **same half as White's
Flag**; `S ≥ 22` gives a **half-turn** (column `c` → `9 − c`, row `r` →
`9 − r`), `S ≤ 21` gives a **reflection** (column unchanged, row `r` →
`9 − r`).

**The threshold must be written as derived, not hard-coded.** Express it from
the army — total numbered pieces, total rank, pieces in the Flag's half — in
the general form `S × 15 > 7 × 45 ⟺ S > 21` given in
`reference/start-position.md` §3, with a comment saying it is correct only for
three each of ranks 1–5 and must be recomputed if the army ever changes. A
bare `22` with no derivation is exactly what the proposal warns against.

The module returns the completed 32-piece starting board plus its position ID
(Step 3). **Mirror-equivalent positions are not collapsed** — say so in the
comment, with the reason (collapsing would bias every game's Flag to one side
of the board).

Why it comes here: it needs the board, the army and the ID encoder, and every
Demotion game begins here. Nothing after this generates a position.

Verification (**automated**): new `startPosition.test.ts`, driving generation
with a small deterministic seeded generator declared in the test file (no new
dependency).

- **Shape**: over many generated positions, White's rows 1–2 and Black's rows
  7–8 are always completely full, rows 3–6 always completely empty, each side
  always holds exactly three of each rank and one Flag, and **White's Flag is
  always on row 1**.
- **Uniformity**: over a large sample, the Flag lands on all eight row-1
  columns, and every rank appears on every one of the 16 White squares at
  least once — no square or column is structurally excluded.
- **The strength rule**: hand-built arrangements exercise the exact boundary —
  a Flag-half sum of **21** takes the reflection branch and a sum of **22**
  takes the half-turn branch — and each branch's mapping is checked square by
  square against a hand-derived expected board. After a half-turn the two
  Flags are in **opposite halves**; after a reflection they are in the **same
  column**, facing each other. Both branches occur over a sample of generated
  positions.
- **The threshold is derived**: the test recomputes it from the army data and
  asserts it equals 21, so a future army change breaks the test rather than
  the game.
- **Openings**: from any generated position, White has exactly **8** legal
  opening squares to move from — one per front-row piece. (Assert the count of
  White pieces on row 2 is 8 here; the _move_ count itself is asserted in Step
  5, once movement exists.)

Run the five repository checks.

---

## Step 5 — Movement: orthogonal steps, the two-square move, direction-relative encumbrance, and White's first move

Status: committed

Notes: Created `src/rules/primary/v3/movement.ts` and `movement.test.ts`,
covering only the orthogonal half of §4.2 and the §4.1 first-move
restriction, exactly as scoped (diagonal attacks are left to Step 6).
`legalDestinations`/`legalAttacks` take an explicit `firstMoveRestricted`
boolean parameter, per the plan. Encumbrance is implemented as
`isEncumbered(position, origin, side, direction)`, driven by a private
`encumberingDirections` switch built directly from the rules' own
description (own direction + its two neighboring diagonals + the two
perpendicular orthogonals); it is exported since later steps' combat
formation-bonus logic and `play.ts` are expected to need it too. Tests
independently restate the five-direction encumbering sets (not by importing
the module's own table) and exercise all 4 travel directions x 8 neighbor
placements (32 cases) plus the full verification list: open-ground and
corner move counts, enemy-behind-does-not-encumber, blocked pass-through by
friendly and by enemy, two-square attack vs. destination disjointness,
Flag immobility, no landing on a friendly piece, no diagonal result ever
produced, the first-move flag on `legalDestinations` and `legalAttacks`, and
White's exactly-8-one-square opening moves across 10 generated starting
positions. One correction made while writing the "free one way / restricted
another" test: an enemy directly behind (south, for a northward move) also
falls in south's, east's and west's own ahead-or-beside sets (the two
perpendicular directions are "beside" for every direction of travel, not
just the one named in the rules' own north example), so that test asserts
north free and south/east/west all encumbered by a single southern enemy,
rather than the originally-drafted (and incorrect) north/east-encumbered,
south/west-free split. No other deviations. All five checks pass; the
`primary/v2` grep under `src/rules/primary/v3/` is zero hits; `git status`
shows no modification under `src/rules/primary/v2/`.

Add `src/rules/primary/v3/movement.ts` with the **orthogonal** half of
`reference/rules.md` §4.2 and the first-move restriction of §4.1:

- one square orthogonally, into an empty square (a move) or onto an enemy (an
  attack);
- **two squares in a straight orthogonal line** when the piece is
  _unencumbered in the direction it is moving_ and the square passed through is
  empty; the far square may be empty (a move) or hold an enemy (an attack);
- **encumbrance is direction-relative**: a piece is encumbered for a given
  direction if an enemy stands on any of the **five squares ahead of or beside
  it** in that direction (for north: NW, N, NE, W, E). The three squares
  **behind** do not encumber. Judged **only from where the piece stands** when
  the move begins; what stands near the destination is irrelevant;
- the Flag never moves and never attacks; no piece moves onto a friendly
  piece; a piece may **never** step diagonally onto an empty square;
- **White's first move of the game is limited to one square** — passed in as an
  explicit flag by the caller, not inferred inside this module.

Keep plain-move destinations and attack targets as two **disjoint** results,
the way major 2 does: an enemy-occupied square is never a destination and an
empty square is never an attack target, so no caller has to re-derive intent.

Diagonal attacks are **deliberately not in this step** — Step 6 adds them.

Why it comes here: it needs only the board and the position model, and both
combat (Step 7) and the play state machine (Step 9) sit on it. Splitting the
diagonal off keeps each half's rule surface small enough to verify in one
pass.

Verification (**automated**): new `movement.test.ts`.

- A lone piece in open ground has four one-square moves and four two-square
  moves; at a corner, two and two.
- **Direction-relative encumbrance, in all four directions**: with an enemy
  directly _behind_ it, a piece may still move two squares forward; with an
  enemy directly ahead, beside it to the left, beside it to the right, or on
  either forward diagonal, the two-square move in that direction is refused
  while the one-square move remains legal. The same piece is simultaneously
  free two squares one way and restricted one square another way, in a single
  hand-built position.
- The two-square move is refused when the passed-through square is occupied,
  by either side, even when unencumbered.
- A two-square move onto an enemy is an **attack target**, not a destination.
- The Flag has no moves and no attacks. No move lands on a friendly piece. No
  diagonal destination is ever produced.
- With the first-move flag set, every result for a White piece is one square
  away; with it clear, the two-square results reappear.
- From a **generated** starting position (Step 4), White has exactly **8**
  legal moves, all of one square, in each of several generated positions —
  `reference/start-position.md` §1's stated invariant.

Run the five repository checks.

---

## Step 6 — Diagonal attacks, with the open-path rule

Status: committed

Notes: Extended `legalAttacks` in `src/rules/primary/v3/movement.ts` with a
diagonal pass built on two new private helpers, `diagonalComponents`
(direction → its two orthogonal components, following the existing
`encumberingDirections` switch-based style so a non-diagonal direction throws
rather than silently returning nothing) and `hasOpenDiagonalPath` (open-path
check per §4.4). `legalDestinations` is untouched — diagonal is attack-only.
One correction to a Step 5 test: "no diagonal destination or attack is ever
produced" asserted no diagonal result of any kind, which was only ever true
because Step 5 didn't implement diagonal attacks yet; it is now split into an
unchanged `legalDestinations`-only assertion (diagonal destinations are still
never produced) plus a full new `describe("diagonal attacks", …)` block
covering every item in this step's verification list (legal with one/both
flanks empty; refused with two friendly, two enemy, and one-of-each
blockers; Flag capturable diagonally and blocked when packed on all four
sides; no diagonal attack on an empty square; no two-square diagonal; an
encumbered piece's diagonal attacks are unaffected; and board-edge/corner
cases with fewer than four diagonal neighbours). This is a deviation from a
literal "extend `movement.test.ts`" reading only in that one existing test
was corrected rather than purely extended — necessary because it encoded a
Step-5-only invariant that Step 6 deliberately supersedes. All five checks
pass (1084 tests, up from 1025); `grep -rn "primary/v2" src/rules/primary/v3/`
is zero hits; `git status --short` shows only `movement.ts` and
`movement.test.ts` modified, nothing under `src/rules/primary/v2/`.

Extend `src/rules/primary/v3/movement.ts` with `reference/rules.md` §4.4: a
piece may attack an enemy on any of its immediate diagonal squares — **any
enemy piece, the Flag included** — subject to two restrictions:

- **an open path is required**: at least one of the two squares orthogonally
  adjacent to _both_ attacker and target must be **empty**; occupied by either
  side, friendly or enemy, counts as blocked;
- **one square only, and never without an attack**: there is no two-square
  diagonal and no diagonal move onto an empty square.

Diagonal attacks are never subject to encumbrance and are never affected by
the first-move restriction's _distance_ limit (a diagonal attack is one square
by definition).

Why it comes here: it is the same module's second rule body, needs everything
Step 5 established, and is what gives the Flag its defence — which Step 8's
endings and Gate F both depend on.

Verification (**automated**): extend `movement.test.ts`.

- A diagonal attack is legal when exactly one flanking square is empty, legal
  when both are empty, and **refused when both are occupied** — asserted
  separately for two friendly blockers, two enemy blockers, and one of each.
- The **Flag can be attacked diagonally** when a path is open, and cannot when
  both its flanking squares are occupied; a Flag packed orthogonally on all
  four sides is unreachable from every diagonal.
- No diagonal result is ever an empty square; there is no two-square diagonal
  in any direction.
- An encumbered piece — one that has lost its two-square move — still has all
  of its legal diagonal attacks.

Run the five repository checks.

---

## Step 7 — Combat: rank, the formation bonus, rank reduction, and Flag capture

Status: committed

Notes: Created `src/rules/primary/v3/combat.ts` and `combat.test.ts`.
`resolveCombat` is a single pure function taking the pre-resolution position
plus origin/target and returning a discriminated `CombatResult` (`kind:
"combat"` with a three-way `outcome` and a nullable `survivorRank`, or `kind:
"flagCapture"` with no rank field, since capture is not combat) together with
the already-resolved position — this both matches the plan's literal list of
fields ("both combatants as they were before resolution, the attacked
square, which of the three results occurred, whether the Flag was captured
... the surviving piece's new rank") and gives Step 9's `play.ts` a
ready-to-use board without re-deriving it from the outcome. The formation
bonus is a private `hasFormationBonus` helper checked fresh against the
pre-resolution position for both attacker (at its origin) and defender (at
its target) — never cached — reusing `board.ts`'s `stepFrom` over all eight
surrounding directions. Sacrificial attacks needed no special-casing: a
weaker piece attacking a stronger one simply falls out of the same
rank-comparison logic as `attackerLoses` (complete sacrifice) or, with the
formation bonus, `draw` (partial sacrifice), exactly as the module comment
explains. One test-design decision beyond the plan's literal verification
list: the "rank reduction never yields a rank below 1, even if a rank 1 is
forced to survive" bullet is, on inspection, unreachable through
`resolveCombat` under these rules — a rank 1 attacker can never outrank a
defender (all ranks are >= 1, and equal rank always draws regardless of the
formation bonus, which only ever converts a loss into a draw, never into a
win) — exactly what rules.md §4.3 itself argues. Rather than assert
something impossible, `combat.test.ts` includes an exhaustive sweep over
every rank pairing and every formation-bonus combination confirming a rank 1
attacker never produces `"attackerWins"` and a rank 1 defender never
produces `"attackerLoses"`, i.e. that the implementation actually upholds
the rules' own argument rather than merely assuming it; the clamp itself
(`reduceRank(1) === 1`) is already directly tested in `position.test.ts`
(Step 2), and `combat.ts` reuses that function rather than reimplementing
it. All five repository checks pass; `grep -rn "primary/v2"
src/rules/primary/v3/` is zero hits; `git status --short` shows only
`combat.ts` and `combat.test.ts` added, nothing under
`src/rules/primary/v2/`.

Add `src/rules/primary/v3/combat.ts`, resolving `reference/rules.md` §4.3:
higher rank wins and the loser is removed; equal ranks draw and both are
removed; the winner advances.

- **Formation bonus**: a friendly piece of **equal rank** within one square
  (orthogonal or diagonal) lets a piece **draw** against a piece one rank
  stronger instead of losing — evaluated for the **attacker before its move**
  (at its origin square) and for the **defender at the moment it is attacked**.
  It is always computed against **current** ranks, so it must be re-derived
  from the live board every time and never cached.
- **Rank reduction**: **any piece that survives combat is reduced by one rank,
  attacker and defender alike**, immediately and permanently, clamped at rank
  1 (Step 2). A **draw reduces nothing** — it leaves no survivor.
- **Capturing the Flag is not combat**: the Flag does not fight, the capturing
  piece is **not** reduced, and the resolution simply removes the Flag.
- **Sacrificial attacks are always legal**: relative strength never restricts
  an attack; this module only resolves what happens.

The resolved outcome must carry enough for the announcement layer to speak
without re-reading the board: both combatants as they were **before**
resolution, the attacked square, which of the three results occurred, whether
the Flag was captured, and — the new one — the **surviving piece's new rank**.

Why it comes here: it needs the position model and the board; the play state
machine (Step 9) applies its result; the announcement layer (Step 13) reads it
verbatim.

Verification (**automated**): new `combat.test.ts`.

- Stronger beats weaker in both directions (attacker stronger; defender
  stronger); equal ranks trade.
- **Rank reduction on the attacker**: a rank 5 beating a rank 3 stands on the
  target square as a rank 4. **Rank reduction on the defender**: a rank 2
  attacking a rank 5 falls, and the rank 5 that held is left as a rank 4.
- A draw reduces nothing — both squares end empty.
- **The formation bonus**: a rank 3 with a friendly rank 3 orthogonally
  adjacent trades with a rank 4 instead of losing; the same rank 3 with the
  friend one square **diagonally** away likewise; with the friend two squares
  away, or of a _different_ rank, it loses as normal. The bonus never lets a
  piece beat a piece two ranks stronger. The **defender's** bonus is checked
  at the moment it is attacked, with the same three cases.
- **The bonus is recomputed after a demotion**: a hand-built position where a
  piece's formation partner has just been demoted out of matching rank —
  asserted to have lost the bonus — and one where a demotion has just created
  a match, asserted to have gained it.
- **Flag capture**: the capturing piece is **not** reduced, and the outcome
  reports a Flag capture rather than a combat result.
- Rank reduction never yields a rank below 1, even if a rank 1 is forced to
  survive.

Run the five repository checks.

---

## Step 8 — Endings: Flag capture, attrition, mutual attrition, inactivity at 40

Status: committed

Notes: Created `src/rules/primary/v3/outcome.ts` and `outcome.test.ts`.
`computeOutcome` takes a `PositionState`, the active side and the shared
inactivity counter (no `PlayState` dependency, matching Step 7's pattern), and
evaluates Flag capture, then mutual attrition, then single-side attrition,
then inactivity, in that order - the ordering is called out explicitly in the
doc comment and exercised by a dedicated test asserting mutual attrition holds
regardless of which side is passed as `activeSide`. `GameEndReason` includes
`resignation` and `agreement` as reachable union members per the plan, though
`computeOutcome` itself never produces them. `INACTIVITY_LIMIT = 40` is
exported with a comment distinguishing it from major 2's 50. No deviations
from the plan. All five repository checks pass; `grep -rn "primary/v2"
src/rules/primary/v3/` is zero hits; `git status --short` shows only
`outcome.ts` and `outcome.test.ts` added, nothing under
`src/rules/primary/v2/`.

Add `src/rules/primary/v3/outcome.ts`, implementing the **detected** endings
of `reference/rules.md` §5 — those settled by the position itself — plus the
two declared ones as reachable outcome values.

- The outcome type: still ongoing; a **win** for a side with a reason
  (`flagCapture`, `attrition`, `resignation`); or a **draw** with a reason
  (`mutualAttrition`, `inactivity`, `agreement`). These are stable
  identifiers, not player-facing text and not record strings.
- Detection, from a board, the side now to move, and the shared inactivity
  counter, in this precedence: **Flag capture** (the side missing its Flag
  loses); **mutual attrition** (a position in which _both_ sides have no
  numbered pieces is a draw — checked before single-side attrition, so neither
  player is credited for having moved last); **attrition** (a side with **no
  numbered pieces** loses immediately — the Flag does not count); then
  **inactivity** at **40**.
- The inactivity limit is **40**, exported as a named constant, with a comment
  noting it is 50 at major 2 and that the two must never be shared.
- **There is no "no legal move" ending at major 3** — attrition replaces it,
  and it is checked after **every** move rather than at the start of a turn.
  Nothing here computes legal plies.
- `resignation` and `agreement` are never _detected_ — they are declared by a
  player (Step 9) — but they belong to the union so every consumer has one
  type to handle.

Why it comes here: it needs only the position model, and Step 9 wires it into
the play state.

Verification (**automated**): new `outcome.test.ts`. A side missing its Flag
loses regardless of what else is on the board; a side holding **only** its
Flag loses by attrition on the very next check; a position where **both** sides
hold only their Flag is a **draw** by mutual attrition and not a win for
either; a side with one numbered piece and a Flag is still ongoing; the
counter at 39 is ongoing and at 40 is a draw by inactivity; a Flag capture
outranks a simultaneous attrition; and the limit constant is exactly 40. Run
the five repository checks.

---

## Step 9 — Notation and the major-3 play state

Status: committed

Notes: Created `src/rules/primary/v3/notation.ts` (a render-only module —
major 3 has no record reader, so unlike v2's `notation.ts` there is no
parser) and `src/rules/primary/v3/play.ts` (`PlayState`, `startPlay`,
`applyMove`, `resign`, `agreeDraw`), plus `notation.test.ts` and
`play.test.ts`. `renderMoveToken(from, to, combat: CombatResult | null)`
derives each square's mark straight from `combat.ts`'s own
`outcome`/`survivorRank`/`kind` fields, so the five notation forms and the
one-mark-per-square invariant fall out structurally rather than needing a
separate encoding; `notation.test.ts` still asserts the invariant with a
property sweep over all 5×5 rank pairings × both sides' formation-bonus
presence (100 combats) plus dedicated Flag-capture and quiet-move cases.
`play.ts`'s `applyMove` mirrors v2's shape (legality re-checked against
`legalDestinations`/`legalAttacks`, `firstMoveRestricted` computed as
`state.moves.length === 0` since White always moves first, counter
reset-on-any-removal, outcome recomputed every ply); `resign` and
`agreeDraw` end the game without appending a move, matching §5.5/§5.6.
One deviation from a literal reading of the step's verification text: the
"scripted full game" test builds its board by hand (`placePiece`, as
`movement.test.ts`/`combat.test.ts` already do) rather than literally
threading a `generateStartPosition(seededRandom(...))` board through the
five hand-chosen plies — a real generated arrangement's piece ranks and
squares are random-but-deterministic, not chosen, so there is no tractable
way to know in advance which squares will produce an attacker win, an
attacker loss, a mutual loss and a Flag capture in a short, legal sequence;
a separate "starting a game" test does exercise `startPlay` directly against
a real `generateStartPosition(seededRandom(...))` output, covering the
"generated position" half of the requirement. All five repository checks
pass (typecheck, lint, 1135 tests including the new 9 + 14, format:check,
build); `grep -rn "primary/v2" src/rules/primary/v3/` is zero hits; `git
status --short` shows only `notation.ts`, `notation.test.ts`, `play.ts` and
`play.test.ts` added, nothing under `src/rules/primary/v2/`.

Add `src/rules/primary/v3/notation.ts` and `src/rules/primary/v3/play.ts`.

**Notation** (`reference/rules.md` §4.5): a move is written from-square, `-`,
to-square, with a mark placed immediately after a square describing the piece
that stood there **when the move began** — `x` (did not survive) or **`=N`
(survived and is now rank `N`)**. In any move involving combat **each of the
two squares carries exactly one mark — never both, never neither**. A move
with no combat carries no marks; `A2-A4x` (one square marked, the other not)
therefore always means a Flag capture. **The simplified `A2A4` form is never
produced.**

**Play state**: the ruleset tag (Step 1's one constant), the starting board
and its position ID, the current board, the side to move, the ordered moves so
far as extended-notation strings, the shared inactivity counter, and the
current outcome. Operations are pure and immutable-style — applying a move
returns a _new_ state — matching major 2's shape.

- Starting a game: White to move, no moves, counter 0, outcome computed
  immediately.
- Applying a move: reject anything not among the moving piece's legal
  destinations or attack targets (a programming-invariant guard — the UI never
  offers one), resolve combat where the target is occupied, write the resulting
  board **including the survivor's demotion**, append the extended-notation
  token, update the counter (**+1** when the move removed no piece, reset to
  **0** the moment any piece is removed), flip the side to move, and recompute
  the outcome. Pass the first-move restriction (Step 5) exactly when this is
  White's first move of the game.
- Two **declared** endings, each ending the game immediately and appending
  **no** move: an **agreed draw**, and a **resignation** by a named side (the
  opponent wins; needs no acceptance, cannot be declined, and no position
  prevents it).

Why it comes here: it is the top of the v3 engine and everything above the
rules layer talks to it. Nothing in the UI exists yet, so it can be verified
entirely by script.

Verification (**automated**): new `notation.test.ts` and `play.test.ts`.

- Notation renders all five forms from `reference/rules.md` §4.5 exactly:
  `A2-A4`, `A2=3-A4x`, `A2x-A4=2`, `A2x-A4x`, `A2-A4x`. A property test over
  every combat resolution asserts **exactly one mark per square**; a
  no-combat move has none; the simplified form appears nowhere.
- A **scripted full game** from a fixed generated position (seeded generator)
  plays a sequence of hand-chosen moves covering: a plain move, an attacker
  win with the attacker demoted, an attacker loss with the defender demoted, a
  mutual loss, and a Flag capture ending the game — asserting the board, the
  move tokens, the counter and the outcome after each.
- The counter rises on quiet moves and resets to 0 on any move that removes a
  piece; a game driven to 40 quiet moves ends as a draw by inactivity.
- Applying a move to a finished game throws; so does moving a piece that is
  not the side to move's; so does an illegal target.
- Resigning ends the game as a win for the opponent, appends no move, and
  works for either side and at any point including move one; agreeing a draw
  ends it as a draw and appends no move.
- White's first move is refused beyond one square; the second White move is
  not.

Run the five repository checks. Also grep the whole of `src/rules/primary/v3/`
for `primary/v2` — **zero hits** — and confirm `git status` shows **no
modification under `src/rules/primary/v2/`**.

---

## Step 10 — Piece art keyed by `(major, glyph)`

Status: committed

Notes: Added `src/art/pieceArt.ts` (the `PieceArt` discriminated union on
`major`, the per-major glyph unions, and the two-level sprite table);
`PieceIcon` now takes a `PieceArt` plus a locally-declared `PieceArtSide`
(`"white" | "black"`, restated rather than imported so `PieceIcon` imports
nothing from `src/rules/`) and draws `art.glyph` as the corner numeral.
Two adapters, both in `src/board/` per the plan: `pieceArtByType.ts` (an
exhaustive `Record<PieceTypeId, Major2Glyph>` for major 2, whose values equal
`PIECE_CATALOG[...].symbol`) and `pieceArtByRank.ts` (an exhaustive
`Record<Rank | "flag", Major3Glyph>` for major 3). One placement decision
beyond the plan's literal text: the major-3 mapping was placed in its own new
adapter file (`pieceArtByRank.ts`), not inlined into `pieceArt.ts`, mirroring
`pieceArtByType.ts`'s shape and keeping `pieceArt.ts` itself free of any
rule-layer type (`Rank`) even though nothing consumes this adapter yet
(Step 14 builds the full major-3 board adapter) — an explicit alternative the
plan itself offers ("next to the v3 adapter work, or in `pieceArt.ts`
itself"). All five call sites updated to go through the appropriate adapter:
`FullBoard.tsx`, `Board.tsx`, `Tray.tsx`, `PlacementControls.tsx` (all via
`pieceArtByType.ts`) and `src/app/rules/RuleFigure.tsx` (the sole permitted
edit in `src/app/rules/` for this whole story — one import line, one prop
change, no copy or figure change). New `src/art/pieceArt.test.ts` asserts all
eight major-2 (glyph, sprite) pairs and all six major-3 pairs explicitly
against the Grounding facts' table, that every numeric glyph `1`-`5` resolves
to a different sprite in the two majors and `F` is the only shared glyph, and
that every referenced sprite id exists in `pieceSprites.svg`. All five
repository checks pass (1166 tests, up from 1135); `git status` shows no
modification under `src/rules/primary/v2/`; `PieceIcon.tsx` has no import
from `src/rules/`.

Re-key the artwork, per Decision 2. **No visual change to major 2.**

- Add a small module (`src/art/pieceArt.ts`) declaring the `PieceArt` value (a
  major and a glyph), the per-major glyph unions, and the **two-level sprite
  table** from the Grounding facts — one row per major, so the two can never
  share a lookup key. The glyph is also the corner numeral.
- `PieceIcon` takes a `PieceArt` (plus the side and class name as today) and
  no longer imports anything from `src/rules/`.
- Add a major-2 adapter (in `src/board/`, not in the rules folder) exposing an
  **exhaustive** `Record<PieceTypeId, …>` mapping into major 2's glyph space —
  so a new major-2 piece type fails to compile — and update the four call
  sites to use it: `FullBoard.tsx`, `Board.tsx`, `Tray.tsx`,
  `PlacementControls.tsx`, and `src/app/rules/RuleFigure.tsx`. **That is the
  only edit permitted in `src/app/rules/` in this whole story**, and it is
  mechanical: no copy change, no figure change.
- Add the major-3 mapping (rank or Flag → glyph) next to the v3 adapter work,
  or in `pieceArt.ts` itself — wherever it lives it must be exhaustive over
  the five ranks plus the Flag.

Why it comes here: it is a self-contained refactor with no behaviour change,
and both the shared board (Step 11) and the Demotion board (Step 14) need art
that can express a major-3 rank.

Verification (**automated**): extend `src/art/pieceSprites.test.ts` (or add a
`pieceArt.test.ts`). For each of major 2's eight piece types, the adapter's
glyph equals the position-block symbol that type has today and the resolved
sprite id equals the one `PieceIcon` used before this step — assert all eight
pairs explicitly against the Grounding facts' table. For major 3, assert all
six pairs. Assert that **every numeric glyph resolves to a different sprite in
the two majors** (`1`–`5`), and that `F` is the only glyph they agree on —
this is the test that would catch a shared-key regression. Assert every sprite
id referenced by either row actually exists in `pieceSprites.svg` (the
existing sprite-sheet test already parses it). Run the five repository checks.

---

## Step 11 — A major-agnostic board view, with major 2 adapted onto it

Status: committed

Notes: Created `src/board/view/viewModel.ts` (`ViewSide`, `ViewSquare`,
`viewSquareKey`, `BoardGeometry`, `BoardToken`, `BoardPosition` — imports
only `PieceArt` from `src/art/pieceArt.ts`, nothing from `src/rules/`) and
`src/board/view/boardOrientation.ts` (`fullBoardRows`, `visibleColumns`,
`fullBoardDisplayPosition`, `movePathSquares`, restated over `BoardGeometry`
with their own local `columnLetter`/`columnIndexOf`, not imported from
anywhere). `FullBoard.tsx` now takes `position`/`side`/`geometry` plus the
existing square-set/announcement/animated-move props, reads occupant names
off `BoardToken.label` (combined with `sideColorName(token.side)` exactly as
before) and terrain off `geometry.impassableSquares`, with its CSS classes
("full-board__square--lake" etc.) and label wording ("lake") left byte-
identical. Added `src/board/boardViewAdapter.ts` (`boardGeometryFor`,
`boardPositionFor`) as the major-2 adapter, using Step 10's
`pieceArtForType` and `PIECE_CATALOG`'s `displayName`; routed `PlayBoard.tsx`
and `ReviewScreen.tsx` through it (`EngineGame.tsx` picks it up transitively
via `PlayBoard`, unchanged). `PlayStatus.tsx`, `DrawOffer.tsx` and
`sideNames.ts` switched to `ViewSide` (type-only; every existing call site
passes a structurally-identical major-2 `Side` unchanged). `GameResult.tsx`
now takes `outcomeKind`/`winner`/`summary` instead of a major-2
`GameOutcome`; `HotSeatGame.tsx` and `EngineGame.tsx` compute
`outcomeKind`/`winner` inline from the already-narrowed `FinishedOutcome` and
pass `describeResult(result[, perspective])`'s output as `summary`, so the
rendered words and the focus-on-mount behaviour are unchanged.

One deviation, explained and scoped narrowly: `boardView.ts`'s `visibleColumns`
was **not** deleted, even though the plan's bullet list names "columns
left-to-right for a side" among the four orientation helpers to move.
`Board.tsx` (the Phase-1 placement board, explicitly out of scope for this
story's UI work per Decision 1's "untouched and major-2-only" list) also
calls `boardView.ts`'s `visibleColumns` for its own cropped view, and
`fullBoardRows`/`fullBoardDisplayPosition`/`movePathSquares` have no such
second caller. Deleting `visibleColumns` from `boardView.ts` would have
forced an edit to `Board.tsx` that this step's own text never lists as a
target. Instead, `boardView.ts` keeps its own `visibleColumns(side, layout)`
unchanged for `Board.tsx`, and `view/boardOrientation.ts` restates an
independent `visibleColumns(side, geometry)` for `FullBoard` — a second,
small instance of exactly the "cheaper to restate than to hoist" reasoning
Decision 1 already applies to `Side`/`Square`. `boardView.ts`'s and
`boardView.test.ts`'s module comments now say so explicitly.

Tests that moved or changed shape, all explained: `boardView.test.ts`'s
`fullBoardRows`/`fullBoardDisplayPosition`/`movePathSquares` describe blocks
moved verbatim (parameterised on hand-built `BoardGeometry` literals instead
of `BOARD_LAYOUTS`, so the new test file stays major-agnostic like the code
it covers) to new `src/board/view/boardOrientation.test.ts`, which also adds
explicit 8x8-geometry cases previously covered by `boardView.test.ts`'s
separate "on the Skirmish layout" describe blocks for those same three
functions (now redundant and removed from `boardView.test.ts`, since
`boardView.ts` no longer exports them) — no coverage was dropped, only
relocated and reparametrised. `boardView.test.ts`'s own `visibleRows`/
`visibleColumns` coverage is untouched. Added new
`src/board/view/viewModel.test.ts` (2 cases for `viewSquareKey`) and
`src/board/boardViewAdapter.test.ts` (5 cases for the new major-2 adapter) —
neither existed before this step.

All five repository checks pass (typecheck, lint, 1175 tests — up from
1166 — format:check, build). `git status` shows no modification under
`src/rules/primary/v2/`; `grep -rn "primary/v2" src/board/view/` finds only
prose mentions inside `viewModel.ts`'s own module comment (explaining the
structural-coincidence rationale), no import statements — confirmed
separately by grepping for `^import` in `src/board/view/*.ts`, which shows
only `vitest`, sibling `./viewModel.ts`/`./boardOrientation.ts` imports, and
`../../art/pieceArt.ts`.

Manual verification (story.md's Gate A) is the owner's to run; not exercised
by this agent. Places to look hardest, since nothing here should be visible
to a player: `FullBoard.tsx`'s square label wording (the literal string
"lake" is now sourced generically from any impassable square rather than a
major-2-specific `isLake` check, though for major 2 today the two sets of
squares are identical by construction) and `GameResult`'s `data-outcome`/
`data-winner` attributes (their _values_ are unchanged — "win"/"draw" and a
side or `undefined` — only how they're computed changed, from reading a
`GameOutcome` object to being passed in pre-narrowed by each caller).

The story's central technical step, per Decision 1. **Major 2's behaviour and
appearance must not change in any way.**

- Create `src/board/view/` with the shared view model: `ViewSide`,
  `ViewSquare`, a square-key helper, `BoardGeometry` (column count, row count,
  impassable square keys), `BoardToken` (side, `PieceArt`, player-facing
  occupant label), and `BoardPosition` (tokens by square key). Move the
  full-board orientation helpers out of `boardView.ts` into this folder,
  re-expressed over a `BoardGeometry`: rows top-to-bottom for a side, columns
  left-to-right for a side, a square's display position, and the move-path
  squares. **`src/board/view/` imports nothing from `src/rules/`.** The
  cropped placement view (`visibleRows`) stays where it is, major-2-only.
- Change `FullBoard.tsx` to take the view model — geometry, position, and the
  four square sets (selected, destinations, attacks, activatable) plus its
  existing last-move, announcement and animated-move props — instead of a
  major-2 `BoardState`/`BoardLayout`. Its square labels, lake icon,
  highlighting policy, activation gate and live region are otherwise
  **unchanged**: it now reads the occupant's name off the token instead of the
  major-2 catalog, and terrain off the geometry's impassable set instead of
  `isLake`.
- Add a **major-2 adapter** in `src/board/` that turns a `BoardLayout` into a
  `BoardGeometry` and a major-2 `BoardState` into a `BoardPosition` (using
  Step 10's glyph mapping and the major-2 display names). Update the three
  `FullBoard` callers — `PlayBoard.tsx`, `ReviewScreen.tsx` and (through
  `PlayBoard`) `EngineGame.tsx` — to go through it.
- Switch `PlayStatus.tsx`, `DrawOffer.tsx` and `sideNames.ts` to the view
  layer's `ViewSide` (a type-only change; every call site is unaffected because
  the two are structurally identical).
- Make `GameResult.tsx` presentational per Decision 5: it takes an
  already-composed summary sentence plus the outcome kind and winner for its
  `data-` attributes, and `HotSeatGame.tsx`/`EngineGame.tsx` pass major 2's
  `describeResult(...)` output. Its focus-on-mount behaviour is unchanged.

**Nothing in `src/rules/primary/v2/` is edited.** If a change there seems
required, the adapter is in the wrong place — stop and escalate.

Why it comes here: Steps 14–16 render a Demotion board through exactly these
props, and doing the refactor before there is a second major keeps the diff
honest — this step is a pure no-op for the player.

Verification (**manual**): run `npm run dev` (**restart the server first — this
container has no file watching**) and confirm story.md's **Gate A** for the
board itself:

1. Start a **Battle** game. Place a few pieces, auto-fill, confirm both
   armies, and play several moves including an attack. The board draws
   identically to before: same square size, same lakes, same artwork, same
   corner numerals, same highlight colours for selection/destination/attack,
   same focus ring.
2. Repeat with **Skirmish** (8 × 8, no buffer) and with **Clash** (10 × 10,
   uneven lakes, including the lake at the board's A edge).
3. With the keyboard only, arrow around the board and confirm every square is
   still reachable and still announces "A5, lake" / "D6, empty" / "F7, Red
   Champion" / "F7, attack Blue Militia" exactly as before.
4. Flip "Flip board between turns" both ways and confirm orientation still
   flips (and stops flipping) as it did.
5. End a game and confirm the result panel reads word-for-word as before, and
   that "New game" still takes focus.

Also run the five repository checks — `npm run build` is what proves the
hidden reviewer and engine screens still compile.

---

## Step 12 — An app-level game catalog spanning majors

Status: committed

Notes: Added `src/games/gameCatalog.ts` (`AppGameId`, `GAME_CATALOG` as an
exhaustive `Record<AppGameId, GameCatalogEntry>` with a discriminated
`source` field, `offeredGames()`, `GameSelection`,
`ruleChoicesFromConfiguration`) and `src/games/gameCatalog.test.ts`. The
three major-2 entries' `name`/`description` are copied verbatim from the old
`GameChoice.tsx` `GAME_DETAIL` and `gameNames.ts` `GAME_NAME` records
(confirmed byte-for-byte against `git show HEAD`); Demotion's entry carries
story.md's fixed copy, `order: 3` (last), and is excluded from
`offeredGames()` by a `source.major === 3` check with a comment pointing to
Step 14. `gameNames.ts`'s `gameName`/`defaultGameId` are re-pointed at the
catalog/`GameSelection`; `gameNameForConfiguration` now calls `gameName`
instead of keeping a second, duplicate major-2 name record (same output,
avoids drift) — `boardSizeDescription` and `reviewedGameLine` are untouched.
`GameChoice.tsx`'s `choice` state is now an `AppGameId`, its buttons/order
come from `offeredGames()`/`GAME_CATALOG`, and `onChoose` reports both a
`GameSelection` and the `RuleConfiguration` built via
`buildGameConfiguration` after narrowing the chosen entry's `source` to
major 2 (an early return, unreachable this step since Demotion is never
offered yet). `HotSeatGame`'s `lastPlayed`/`onGameStarted` props and
`App.tsx`'s session-memory state now carry `GameSelection | null`; the
`RuleConfiguration` `GameChoice` also reports is still what
`HotSeatGame.handleChooseGame` uses to start placement, unchanged. One small
deviation beyond the plan's literal text: `App.tsx`'s state variable was
renamed from `lastPlayedConfiguration` to `lastPlayedSelection` to match its
new type (not requested explicitly, but the plan's own Grounding facts
describe it by the old name as something Step 12 changes; the rename is
purely cosmetic and every use site was updated). All five checks pass
(typecheck, lint, 1189 tests, format:check, build); `git diff --stat` for
`src/rules/primary/v2/` is empty; the picker's three visible name/description
strings are unchanged (verified both by `gameCatalog.test.ts`'s
character-for-character assertions and by diffing against the pre-step
`GAME_DETAIL`/`GAME_NAME` records).

Introduce the identity layer of Decision 3, **without yet adding Demotion** —
the picker must look and behave exactly as it does today after this step.

- Add `src/games/gameCatalog.ts`: the `AppGameId` union (with `"demotion"`
  present in the union from the start), the exhaustive catalog record carrying
  each game's name, description, display order, board-size phrase and source
  major, and the offered-games list. The three major-2 entries carry the exact
  names and descriptions `GameChoice.tsx`'s `GAME_DETAIL` and `gameNames.ts`'s
  `GAME_NAME` hold today, moved verbatim. Demotion's entry carries its
  story-fixed copy — name **"Demotion"**, description **"Play on an 8x8 fixed
  board. When a piece wins a battle, it is demoted one rank."**, board-size
  phrase "an 8x8 board", order **last** — but is **excluded from the offered
  list by this step**, with a comment saying Step 14 includes it.
- Add the `GameSelection` type (the `AppGameId` just played plus the player's
  major-2 rule choices) and thread it: `App.tsx` holds a `GameSelection | null`
  instead of a `RuleConfiguration | null`; `HotSeatGame` reports one from
  `onGameStarted` and receives one as `lastPlayed`; `GameChoice` pre-selects
  from it.
- Re-point `gameNames.ts`'s `gameName` and `defaultGameId` at the catalog and
  the selection. `gameNameForConfiguration`, `boardSizeDescription` and
  `reviewedGameLine` stay as they are — they answer major-2 questions for the
  reviewer and the announcement.
- `GameChoice.tsx` renders its game buttons, descriptions and order from the
  catalog rather than its own private records, and builds a major-2
  `RuleConfiguration` for the chosen game exactly as it does today.

Why it comes here: Step 14 needs a game identity that does not belong to
either major, and doing the migration while there is still only one major
keeps it verifiable as a no-op.

Verification (**automated**): update `gameNames.test.ts` and add
`gameCatalog.test.ts`. The catalog is exhaustive over `AppGameId`; the offered
list is exactly Skirmish, Clash, Battle **in that order**; each major-2 entry's
board-size phrase equals `boardSizeDescription(buildGameConfiguration(...))`
for its source game (so the catalog can never drift from the real layout);
`defaultGameId` returns Skirmish for a null selection and the last-played game
otherwise, including for a Demotion selection; and each entry's name and
description match the strings the picker showed before this step, character
for character. Run the five repository checks.

---

## Step 13 — The major-3 session, announcements, and a parameterized inactivity warning

Status: committed

Notes: Created `src/board/v3PlaySession.ts` and `src/board/v3PlayAnnouncement.ts`,
mirroring `playSession.ts`/`playAnnouncement.ts`'s contracts exactly (session
state shape, `isInert`, `viewSide`, `actionableSquares`/`attackTargets`/
`activatableSquares`/`activateSquare`, the draw-offer transitions) plus the
new `resign` transition (Decision 9), and `describeResult` producing Decision
5's six sentences character-for-character (verified by an explicit
table-driven test). `describeActivation`'s attack sentence names a
survivor's new rank via a small `rankLabel(rank)` helper only for
`attackerWins`/`attackerLoses`, leaving the `draw` and `flagCapture` branches
unchanged (asserted directly, per the plan's "assert both cases" guidance).
Selection announces "{Colour} {Name}, rank {N} selected, {count} moves
available." (a new `pieceDescriptionWithRank` helper), per Decision 6/Step
13's "colour, rank name and rank number" requirement — the only place a rank
digit appears outside a demotion. Parameterized `playWarnings.ts` per
Decision 10 (`computeCountdownWarnings(ongoing, inactivityCounter, limit)`,
no `PlayState` import at all), and updated its two test files plus **two**
production callers, `HotSeatGame.tsx` and `EngineGame.tsx` (a small deviation
from the plan's "its one caller" — `EngineGame.tsx`'s call site is inside the
currently-hidden against-the-computer screen, which still had to keep
compiling and calling the new signature correctly for `npm run build`'s
hidden-tree check to stay meaningful); both now pass
`playSession.play.result.kind === "ongoing"`, `playSession.play.inactivityCounter`
and major 2's own `INACTIVITY_LIMIT` explicitly. One correction made while
writing `playWarnings.test.ts`'s new "different limit" case: the literal
boundary numbers in this step's verification text ("at 30 there is no
warning and at 31 there is", limit 40, threshold 10) do not hold under the
threshold's own unchanged `movesRemaining <= 10` comparison — by that
formula (and by major 2's own boundary, where the first warning appears
exactly at `counter = limit - 10`), the first warning at limit 40 appears at
counter 30, not 31. The new test asserts the boundary that is actually
consistent with "the 10-move threshold is unchanged" (no warning at 29, a
warning with 10 remaining at 30) rather than the plan's literal numbers,
which would have required silently changing the comparison operator to
match. All five repository checks pass (1227 tests, up from 1189); grep for
`primary/v2` inside the two new v3 modules and their tests is zero hits;
`git status` shows no modification under `src/rules/primary/v2/` or
`src/rules/primary/v3/`; major 2's existing `playWarnings.test.ts`/
`playWarnings.game.test.ts` expectations pass unchanged (same assertions,
now read through a small `warningsFor(state)` helper that extracts the three
primitives from a major-2 `PlayState`).

Add the thin, rules-shaped layer for major 3 (Decision 1), all pure and with
no React dependency, so it is unit-testable in the project's `node` Vitest
environment.

- `src/board/v3PlaySession.ts` — the interaction state machine, mirroring
  `playSession.ts`'s contract: the current play state, the selected square (or
  none), the last resolved outcome, and any pending draw offer; the sets of
  **actionable** squares (highlighted), **attack targets**, and
  **activatable** squares (the strictly larger set that responds to a click or
  Enter/Space, so deselecting and switching selection stay reachable); the
  activation transition (select / deselect / switch / apply a move); the
  board going **inert** when the game has ended or a draw offer is pending; the
  view side (whose perspective to draw from, honouring "Flip board between
  turns" and handing the board to a draw-offer responder); and the
  offer/accept/decline transitions plus **resign**.
- `src/board/v3PlayAnnouncement.ts` — the live-region wording: selecting a
  piece (naming it by **colour, rank name and rank number**, plus how many
  moves it has), deselecting, a plain move, an attack — **naming the
  survivor's new rank in words** per Decision 6 — the draw offer/decline/accept
  sentences, a resignation, and `describeResult` producing exactly the six
  sentences in Decision 5's table. Player-facing vocabulary throughout:
  colours, never "White"/"Black"; "move", never "ply"; no edition id, flag id
  or value token anywhere.
- `src/board/playWarnings.ts` — parameterized per Decision 10: takes whether
  the game is ongoing, the counter and the **limit**, instead of a major-2
  `PlayState`. Update its two existing test files and its one caller. The
  sentence and the 10-move threshold are unchanged.

Why it comes here: it needs the v3 engine (Steps 1–9) and nothing from React;
Steps 14–16 consume it. Building it now keeps those steps to wiring and
looking.

Verification (**automated**): new `v3PlaySession.test.ts` and
`v3PlayAnnouncement.test.ts`, plus the updated `playWarnings.test.ts` /
`playWarnings.game.test.ts`.

- Session: selecting one of the side-to-move's own movable pieces, deselecting
  it by re-activating, switching to another own piece, applying a move, and
  no-ops for an enemy piece, the Flag, and an empty non-destination square;
  the activatable set is a strict superset of the actionable set while a piece
  is selected; every set is **empty** when the game has ended and while a draw
  offer is pending; the view side follows the side to move, flips to the
  responder while an offer is pending, and stays red when flipping is off;
  resigning ends the game and leaves the board inert.
- Announcements: the exact sentence for a plain move, for an attacker win
  **naming the attacker's new rank**, for an attacker loss **naming the
  defender's new rank**, for a mutual loss (naming no new rank — a draw reduces
  nothing), for a Flag capture (naming no new rank — capturing the Flag is not
  combat), and each of the six result sentences from Decision 5's table.
- Warnings: at counter 29 there is no warning and at counter 30 there is
  (limit 40, threshold 10 — so the first warning appears with exactly 10 moves
  remaining, matching major 2's own boundary at counter 40 of limit 50), and
  major 2's existing expectations at limit 50 still pass unchanged.

  **Corrected during implementation.** This bullet originally read "at 30
  there is no warning and at 31 there is", which is off by one: it would have
  meant warning at 9 moves remaining, and honouring it literally would have
  required changing the `movesRemaining <= 10` comparison — silently moving
  major 2's boundary too, in a step whose whole point is that the threshold is
  unchanged.

Run the five repository checks.

---

## Step 14 — Demotion appears in the picker and starts a game

Status: committed

Gate note (owner, at the manual gate): Gates B and C pass. The opening
announcement was **not** confirmed audibly — the owner has no screen reader
available — so it is verified by code inspection only: the `role="status"`
region is a single element rendered at the same position in all four
branches, mounted and empty before `handleChooseDemotion` sets its text, and
`sr-only` by CSS, so there is nothing to observe without assistive tech.
**Gate I (Step 17) is where the accessibility claim gets its real pass**;
until then this story's screen-reader behaviour is unverified, not verified.

Notes: `gameCatalog.ts`'s `OFFERED_GAME_IDS` filter now includes every
major-3 entry unconditionally (Demotion has no `combinationFits`-style floor
to fail), so `offeredGames()` returns Skirmish, Clash, Battle, Demotion.
`GameChoice.tsx`'s `onChoose` (and `HotSeatGame`'s `handleChooseGame`) now
take `RuleConfiguration | null` — `null` for a major-3 selection — and the
"Diagonal attacks" section is wrapped in `showRuleChoices`
(`GAME_CATALOG[choice].source.major === 2`), so it disappears for Demotion
without touching `flagOverrides`
(the state Gate B's "previous selections intact" depends on). Added
`src/board/DemotionGame.tsx` (turn indicator, flip toggle, `FullBoard` with
no activatable squares) and `src/board/boardViewAdapterV3.ts`
(`boardGeometryForDemotion` — fixed 8x8, empty `impassableSquares` —
and `boardPositionForDemotion`, whose numbered-piece labels read
"{Rank name}, rank {N}" so a re-read always names the piece's _current_
rank, per Decision 6). `HotSeatGame.tsx` gained a fourth branch
(`demotionSession !== null`) with the same element order as the other three,
and a new `handleChooseDemotion` that calls `generateStartPosition()` (the
default `Math.random` source), starts a v3 `PlaySession` (aliased
`DemotionPlaySession`/`startDemotionSession` to avoid colliding with major
2's own `PlaySession`/`startSession`), and sets Decision 11's exact opening
announcement into the existing `gameAnnouncementRegion`. One deviation from
a literal reading of the plan, recorded because it touches the shared shell:
the heading-refocus effect and `gameInProgress` were rewritten to depend on
a derived `gameChosen` boolean (`configuration !== null || demotionSession
!== null`) rather than depending on `demotionSession` directly — a literal
`[configuration, demotionSession]` dependency array would refire the effect
and steal focus back to the heading on _every_ move once Step 15 starts
replacing `demotionSession` with a new object on each ply (a new object
reference re-triggers a `useEffect`, unlike the primitive boolean); the
plan's own text only requires "the heading-refocus effect must fire for this
branch too," which the boolean still satisfies exactly, without setting up a
one-step-later regression. Added `boardViewAdapterV3.test.ts` (geometry has
no impassable squares; occupied-square art/label mapping including a
generated 32-piece position) and updated `gameCatalog.test.ts`'s
`offeredGames` tests for the new fourth entry. All five checks pass
(typecheck, lint, 1233 tests, format:check, build); `src/rules/primary/v2/`
is untouched (`git status --short` empty for that path) and
`src/rules/primary/v3/` needed no change, per the constraints.

Make Demotion reachable and show its generated starting position. **No
interaction yet** — the board draws, and nothing responds.

- Include Demotion in the catalog's offered list (Step 12 left it excluded),
  last in display order.
- `GameChoice.tsx`: four game buttons. Selecting Demotion shows its
  description and **hides the "Diagonal attacks" section entirely** (the four
  game buttons stay visible so a player can switch back; selecting any other
  game brings the section straight back with its previous selections intact,
  because the choices live in state that the hidden section never clears).
  "Play" reports a `GameSelection` naming Demotion.
- `HotSeatGame.tsx`: per Decision 11, add a fourth branch. When the chosen
  game's source major is 3, generate a starting position, start a v3 play
  session, and render a new `DemotionGame` component inside the **same shell,
  in the same element order** as the other three branches. Set the opening
  announcement into the existing game-announcement region with the wording in
  Decision 11. The heading-refocus effect must fire for this branch too. No
  placement session, no tray, no confirm, not even briefly.
- Add a **major-3 adapter** (alongside Step 11's major-2 one) turning the v3
  board into a `BoardPosition` — occupant labels reading "Master-of-Arms, rank
  5" style names, art from Step 10's major-3 glyphs — and the fixed 8 × 8 board
  into a `BoardGeometry` with **no impassable squares**.
- `DemotionGame` renders, for now: the turn indicator, the flip-board toggle,
  and the full board through `FullBoard` with **no** activatable squares.

Why it comes here: it is the first player-visible slice, it needs Steps 10–13,
and separating "the game starts and draws" from "the game plays" keeps two
large manual gates apart.

Verification (**manual**): restart `npm run dev`, then confirm story.md's
**Gate B** and **Gate C**:

1. **Gate B** — the "Choose a game" screen offers **four** games in the order
   Skirmish, Clash, Battle, Demotion. Selecting Demotion shows exactly _"Play
   on an 8x8 fixed board. When a piece wins a battle, it is demoted one
   rank."_ and the "Diagonal attacks" section disappears; selecting Battle
   brings it straight back with whatever was selected before still selected.
   No "experimental", "proposed" or "pre-release" wording appears anywhere.
   "Play" starts the right game for each of the four.
2. **Gate C** — choosing Demotion goes **straight to a board**: no placement
   screen, no tray, no hand-off, not even for a frame. The board is 8 × 8. Rows
   1–2 and 7–8 are completely full and rows 3–6 completely empty. There are no
   lakes anywhere. White's (red's) Flag is on row 1. The two armies are
   congruent — either a half-turn of each other (Flags in opposite halves) or a
   reflection (Flags in the same column, facing each other). Start five or six
   fresh Demotion games and confirm the arrangements are visibly different and
   that **both** turn branches show up across them.
3. Return to the picker after a Demotion game (via "Back to start", then "Play
   a game") and confirm **Demotion is pre-selected**.
4. With a screen reader, confirm the opening announcement is spoken on arrival
   and names the game, the board and who moves first.

Also run the five repository checks.

---

## Step 15 — Playing a Demotion game

Status: pending

Wire interaction into `DemotionGame`: square activation through the v3 session
(Step 13), highlighted destinations and attack targets, the activatable set
driving which squares respond, and the live-region announcement derived from
each transition. The board's orientation follows the v3 session's view side
and the "Flip board between turns" setting.

Nothing about endings, the result panel, the draw offer or resignation is in
this step — a game that ends simply stops being interactive (the session goes
inert), and Step 16 adds the presentation for it.

Why it comes here: it needs Step 14's rendering and Step 13's session, and it
is the step that proves the rules the story cares most about — encumbrance,
open-path diagonals and rank reduction — are actually reaching the player.

Verification (**manual**): restart `npm run dev`, start a Demotion game, and
confirm story.md's **Gates D, E and F**:

1. **Gate D — movement.** One-square orthogonal moves work everywhere.
   **White's very first move is refused beyond one square** and unrestricted
   thereafter. A two-square move is offered only through an **empty** square,
   and only when unencumbered **in that direction** — demonstrate a piece free
   to advance two squares with an enemy directly **behind** it, and the same
   piece restricted to one square with an enemy ahead of or beside it. No
   diagonal move onto an empty square is ever offered.
2. **Gate E — combat and demotion.** A stronger piece beats a weaker one and
   is **shown at one rank lower** afterwards — **artwork and corner numeral
   both**. Equal ranks trade. The formation bonus turns a loss against a
   one-stronger piece into a trade. A **defender** that survives is likewise
   demoted. A demoted piece then fights and forms up at its **new** rank for
   the rest of the game.
3. **Gate F — diagonal attacks.** A diagonal attack is offered when one of the
   two flanking squares is empty and refused when both are occupied —
   confirmed with **friendly** blockers as well as enemy ones. **The Flag can
   be captured diagonally**, and a Flag with both diagonals closed cannot be.
4. Every one of the above is reachable with the keyboard alone, and the live
   region announces the selection (with its move count), the move, and each
   combat result **including the demotion of the surviving piece**.

Also run the five repository checks.

---

## Step 16 — Every ending: results, resignation, and the countdown at 40

Status: pending

Complete `DemotionGame`:

- the result panel (Step 11's presentational `GameResult`) fed by v3's
  `describeResult`, replacing the turn indicator once the game ends, with
  "New game" returning to the picker exactly as it does for the other three
  games;
- the draw offer (the existing shared `DrawOffer` control) wired to the v3
  session's offer/accept/decline;
- the **resign control** per Decision 9 — a `ResignControl` component beside
  the draw offer, rendered only here, with its two-step confirmation, focus on
  Cancel, and wording that never implies the opponent accepts anything;
- the inactivity countdown, through Step 13's parameterized warning, against
  **40**.

Every ending pushes its sentence into the same live region the ply narrative
uses, so nothing is announced twice from two regions.

Why it comes here: it is the last functional slice, and it needs everything
before it.

Verification (**manual**): restart `npm run dev` and confirm story.md's
**Gate G** — every ending, each in its own Demotion game:

1. **Flag capture** — orthogonally in one game, **diagonally** in another.
2. **Attrition** — a player reduced to a Flag alone loses **immediately**,
   mid-move-pair, without waiting for their turn.
3. **Mutual attrition** — one move leaving both players with no numbered
   pieces is a **draw**, not a win for the player who moved.
4. **Inactivity** — the countdown warning appears and counts down against
   **40**, not 50, and the game draws when it reaches it. **Play this one out
   in full** (owner decision at the plan gate): shuffling two pieces back and
   forth for 40 moves is slow, but it is the only check that exercises the
   counter, the warning and the result panel together in the running app. The
   automated coverage in Steps 8–9 proves the limit fires; this proves the
   player sees it happen.
5. **Resignation** — available to the player to move at any point, takes
   effect **immediately** with no acceptance from the opponent, cannot be
   declined, is reachable and confirmable by keyboard alone, and Cancel leaves
   the game exactly as it was.
6. **Draw by agreement** — offer, decline (play returns to the offering
   player, who still has their turn), then offer and accept.

In each case the result sentence matches Decision 5's table, is announced once
to the screen reader, and "New game" returns to the picker with Demotion
pre-selected. Also run the five repository checks.

---

## Step 17 — Cross-major sweep: nothing leaks, everything is reachable

Status: pending

No new feature. A deliberate pass over the seam, with the fixes it turns up:

- **Copy sweep.** Grep every player-facing surface touched by this story
  (`GameChoice.tsx`, `HotSeatGame.tsx`, `DemotionGame`, the v3 announcement
  module, the resign control, `gameCatalog.ts`) for `ply`, `edition`,
  `PRE-RELEASE`, `3-0:` and `White`/`Black` as _displayed_ words. None may
  appear in a rendered string. Piece names must be the major-3 names, and the
  sides must be Red and Blue.
- **Version-wall check.** Grep `src/rules/primary/v3/**` for `primary/v2` and
  `src/rules/primary/v2/**` for `v3` — zero hits both ways — and confirm
  `git diff --stat` for the whole branch touches **no file** under
  `src/rules/primary/v2/`, `src/rules/readRecord*`, `src/engine/` or
  `src/encoding/`.
- **Accessibility pass** over the two things that are new to announce: a
  piece's rank **changing** mid-game, and a game that **begins already in
  progress** with no placement to orient the player.

Why it comes here: it needs the whole feature present, and the leaks it looks
for are exactly the ones that a per-step check cannot see.

Verification (**manual**): restart `npm run dev` and confirm story.md's
**Gates A, H and I**:

1. **Gate A — the other three games are untouched.** Play a **Battle**, a
   **Skirmish** and a **Clash** game each through choice, placement (including
   auto-fill, swap, return-to-tray and the Skirmish tower/lane refusal),
   hand-off, play, and an ending. The diagonal-attack choices are offered and
   **applied** exactly as before. Nothing about these three has changed.
2. **Gate H — rank numbering does not leak.** In the **same session**, play a
   Demotion game and a Battle game. In Demotion rank 5 is the strongest piece;
   in Battle rank 1 is. **No piece in either game is drawn with the other
   major's artwork or corner numeral** — check Foot Soldier and Militia
   specifically, since those two swap places between the majors.
3. **Gate I — accessibility.** With the mouse put away entirely: choose
   Demotion, play a full game to a **Flag capture**, and **resign** a second
   game. All of it works by keyboard alone, and the screen reader announces
   the starting position on arrival, each move, each combat result **including
   the demotion of the surviving piece**, and the final result.

Also run the five repository checks.

---

## Step 18 — README check

Status: pending

Verify `README.md` is still accurate given this story's changes, and update it
if it is not. It currently says **"There are three games to choose from"** and
describes Skirmish, Clash and Battle; the "Set up a game with a friend" bullet
says "pick Skirmish, Clash, or Battle" and describes secretly placing an army;
the "Win, lose, or draw" bullet describes major 2's endings ("no legal move at
all", "fifty moves ... with no piece captured"); and the Status note says
"pick Skirmish, Clash, or Battle, place both armies".

All four are now wrong or incomplete for a player who meets Demotion on the
first screen. The update must, in the README's plain, non-technical voice:

- name **four** games and describe Demotion the way a player meets it — an
  8 × 8 board, both armies already set out and generated fresh each game, no
  army to place, and pieces that get **weaker as they win**;
- say that Demotion's ranks run the other way round (5 strongest), since a
  player switching between games will notice;
- mention that a Demotion game can be **resigned**, and that its inactivity
  draw comes at **forty** moves rather than fifty;
- add a short paragraph to "The rules" saying Demotion's rules aren't official
  yet — they're a proposal from the companion project — following the
  precedent of the existing diagonal-attack and Clash paragraphs, and **linking
  to the companion repository**, not to this repository's `reference/` copy;
- contain **no** edition id, flag identifier, value token, position ID or the
  word "ply" anywhere.

`/update-readme` automates the diff review and may be used, provided the result
is checked against every point above.

Why it comes here: it is the last step, and it needs the final shape of the
feature.

Verification (**manual**): read `README.md` end to end as a first-time player
who has never seen this app. Four games are named and described; nothing
describes placement as if it applied to all four; the endings paragraph is
true for both majors; no jargon has crept in. Then run the five repository
checks (`npm run format:check` also covers the README's formatting).
