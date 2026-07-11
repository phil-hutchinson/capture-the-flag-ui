# Implementation Plan — Story 00000005: Phase 2 combat (attacks & capture resolution)

This plan gives Phase 2 its combat. It builds **directly on story 00000004**,
which delivered the versioned `PlayState`, the `legalDestinations` movement
logic, the pure turn/selection state machine (`playSession.ts`), the reusable
accessible grid, the perspective-flipping full-board renderer (`PlayBoard.tsx`),
live-region announcements, and the developer-facing game-record dump. **Attacks
extend that model — they must not fork it.** No new game-state model, no parallel
interaction path, no second rendering component.

Read `story.md` in this folder first. This plan assumes the reader has read only
`story.md`, this plan, and their own step — every fact a step needs is stated in
the plan. Do **not** re-read the companion rules documentation: the story's
"Background & references" section captures every ruleset fact you need, and the
story instructs that no re-check is required.

---

## Grounding facts (from the story and the existing codebase)

**Ruleset:** combat is rule logic and lives with the other per-version rule
logic under `src/rules/primary/v1_1/`, tagged `RULESET_TAG = "PRIMARY:1.1"`,
consistent with stories 00000001 and 00000004. The story states the ruleset is
1.1 and that no re-check of the companion repository is needed.

**The combat model to implement (ruleset 1.1, per the story's Background):**

- **Attacking = moving a piece onto an enemy-occupied square.** Exactly three
  outcomes: **attacker wins** (defender removed, attacker advances onto the
  square), **attacker loses** (attacker removed, defender stays), **mutual loss**
  (both removed, square left empty).
- **Rank decides between two numbered pieces:** the **lower-numbered (stronger)**
  piece wins. **Equal rank is mutual loss** — the default for every rank,
  overridden only by the Knight-vs-Knight charge and Assassin-vs-Assassin.
  (Rank numbers live in `pieces.ts` as `PIECE_CATALOG[type].rankCode`: 1–9 for
  numbered pieces, `"special"` for the Assassin, `null` for Tower and Flag.)
- **Sacrificial attacks are legal:** any piece may attack any enemy piece
  regardless of relative strength (a stronger defender simply removes the
  attacker).
- **Knight — charge:** a Knight may move **2 or 3 squares in a straight line
  only when the move ends in an attack**, over a clear line (no pieces of either
  side, no lakes, in the intervening squares). A **1-square** Knight attack is an
  ordinary attack, **not** a charge. (Story 00000004 already limits a
  non-attacking Knight to one square.)
- **Skirmisher — rush:** up to 3 squares in a **clear** straight line for
  movement (built in 00000004) **or** attack (this story adds the attack half).
- **Assassin:** **wins whenever it attacks**, **loses whenever it is attacked**,
  regardless of rank. **Assassin-vs-Assassin: the attacker wins.** The guaranteed
  win does **not** extend to Towers (an Assassin attacking a Tower is destroyed
  while the Tower stands — a Tower is not a numbered piece).
- **Sapper and Tower:** **only a Sapper destroys a Tower** (Sapper wins and
  advances). **Any other piece** attacking a Tower is **removed while the Tower
  stands** (a complete sacrifice). Towers never move and never attack.
- **Halberdier vs. Knight:** a Knight may **not charge** a Halberdier — it must
  attack from an adjacent square (an ordinary 1-square attack), then wins
  normally (rank 3 over rank 5). The Halberdier gains nothing on offense; on
  defense its only effect is to forbid being charged.
- **Knight vs. Knight — charge exception:** a Knight that **charges** another
  Knight **wins and advances**; an **adjacent** (1-square) Knight-vs-Knight
  attack is normal **mutual loss** (equal rank 3).
- **Archer — defensive support:** if a friendly piece **adjacent** to an Archer
  **loses a defensive combat**, and the Archer stands **directly opposite the
  attacker — one square beyond the defender, continuing the attacker's exact
  straight line of travel** — the result becomes **mutual loss** (the attacker
  is also removed; the supporting Archer itself is not removed). Support:
  - **extends to Towers** (a supported Tower trades with the Sapper demolishing
    it — both removed);
  - does **not** make the Assassin immune (an attacking Assassin that is
    supported-against is also removed → mutual loss);
  - uses the attacker's **line of travel** for the trigger-square geometry, the
    same whether the attack was a 1-square step, a charge, or a rush;
  - does **not** fire if the trigger square is **off-board**, a **lake**, or does
    **not** hold a **friendly Archer** (friendly to the defender);
  - is **defensive only**: it never helps a piece that is itself the attacker.
  - The Archer's **own** combat (when the Archer is itself attacker or defender)
    is by rank (rank 8) — support is a bystander effect, not an Archer combat
    buff.
- **A piece may never move onto a friendly-occupied square** (unchanged from
  00000004).
- **The Flag is NOT attackable in this story.** Capturing the Flag is winning
  (story 00000006's concern), so **a square holding a Flag is simply never
  offered as an attack target** — the same structural quietness 00000004 uses for
  occupied squares. No special UI. (Towers, by contrast, are fully attackable
  here.)

**Repository facts to build on (story 00000004; reuse, do not rebuild):**

- `src/rules/primary/v1_1/board.ts` — geometry: `Column`, `Row`, `Side`
  (`"white" | "black"`), `Square`, `squareKey`, `allSquares`, `isLake`,
  `COLUMNS`, `ROWS`.
- `src/rules/primary/v1_1/pieces.ts` — `PieceTypeId`, `RankCode`
  (`1..9 | "special" | null`), `PIECE_CATALOG` (per-type `displayName`,
  `rankCode`, `symbol`, `quantityPerSide`).
- `src/rules/primary/v1_1/gameState.ts` — `RULESET_TAG`, `PlacedPiece`
  (`{ side, pieceType }`), `BoardState`
  (`Readonly<Record<string, PlacedPiece>>` keyed by absolute `squareKey`),
  `InitialGameState`, `renderPositionBlock`.
- `src/rules/primary/v1_1/movement.ts` — `legalDestinations(board, origin)`
  (empty-square moves only) and `hasAnyLegalMove(board, side)`. The internal
  ray-walk stops at the first lake or occupied square **without** including it
  as a destination; a helper `step(square, dc, dr)` computes an orthogonal
  neighbour and the four orthogonal direction deltas are already defined. This
  module is the natural home for the new attack-target logic.
- `src/rules/primary/v1_1/play.ts` — `PlayState`
  (`ruleset`, `initialBoard`, `board`, `sideToMove`, `moves: readonly string[]`),
  `startPlay`, `applyMove(state, from, to)` (immutable, throws on an illegal
  move — a programming-invariant guard, since the UI never offers one), and
  `renderGameRecord(state)`. Moves are recorded as `squareKey(from) +
squareKey(to)` (e.g. `"A2A3"`), no separator, no markers.
- `src/board/playSession.ts` — `PlaySession` (`{ play, selection }`),
  `startSession`, `actionableSquares` (drives visual **highlight**),
  `activatableSquares` (drives which cells **respond** to activation),
  `activateSquare` (select / deselect / switch-selection / move). Distinguishes
  own movable pieces via `isOwnMovablePiece` (own piece with ≥1
  `legalDestinations`).
- `src/board/playAnnouncement.ts` — `describeActivation(before, after, square)`,
  a pure function returning the live-region sentence from a `PlaySession`
  transition ("… selected, N moves available." / "… moved to X. Blue to move." /
  "… deselected.").
- `src/board/PlayBoard.tsx` (+ `PlayBoard.css`) — the full 12×12 renderer through
  `AccessibleGrid`. Each cell carries `content`, an accessible `label`
  (`squareLabel`), `focusable`, and `actionable` (from `activatableSquares`).
  Visual highlight classes: `--selected` (picked-up piece) and `--destination`
  (a selected piece's legal move target; amber fill, no border). The amber
  **border** is reserved for the keyboard-focus ring.
- `src/board/PlayStatus.tsx` — "Red to move" / "Blue to move" indicator;
  side `"white"` → **Red**, `"black"` → **Blue**.
- `src/board/GameRecord.tsx` — collapsed `<details>` dump of `renderGameRecord`.
- `src/App.tsx` — Phase-2 branch (active when `playSession !== null`): renders
  `PlayStatus`, `PlayBoard`, `GameRecord`; `handlePlayActivate` routes a cell
  activation through `activateSquare`, then `describeActivation` for the
  announcement.

**Testing conventions (unchanged from 00000004):** Vitest with a **`node`**
environment — **no jsdom, no DOM/component testing library**. Pure rule logic,
state machines, and announcement wording get automated `*.test.ts` colocated
next to their module. React component / ARIA / keyboard / screen-reader behavior
is covered by the story's **manual gates** — do **not** add a DOM test stack
(that deferral is already recorded as a proposed story). Commands:
`npm run typecheck`, `npm run lint`, `npm test`, `npm run format:check`,
`npm run build`.

**Player-facing text:** sides are **Red / Blue** (never "White"/"Black"), piece
names come from `PIECE_CATALOG[...].displayName` (Knight, Skirmisher, Lord
Marshal, …), and the word is **"move"**, never "ply".

**Key design decisions (settled here so each step can assume them):**

- **Attack targets are computed separately from moves, in the same module.** Add
  a `legalAttacks(board, origin)` to `movement.ts` alongside `legalDestinations`
  — enemy-occupied targets, honoring range/line/charge/exclusion rules — rather
  than merging the two. Keeping the two sets distinct at the rule layer is what
  lets the UI mark attack targets differently from plain moves (in-scope item 2)
  without re-deriving intent. This **extends** the movement model; it does not
  fork the play-state model.
- **Combat resolution is a pure function returning a structured outcome.** A new
  `combat.ts` computes `resolveCombat(board, from, to)` → a `CombatOutcome`
  discriminated value describing which of the three results occurred, the
  attacker and defender pieces (side + type), the attacked square, whether a
  defender fell (a "capture"), and whether Archer support fired. Resolution is
  **deterministic and rules-complete** by the end of this story (a hard
  constraint — recorded games must replay identically forever).
- **The resolved outcome is exposed, not buried, for story 00000006.** Move
  application returns the new `PlayState` **and** the `CombatOutcome` (for a
  plain non-combat move, a "just a move" result). `PlaySession` carries the most
  recent resolved outcome so the announcement layer can describe it and so
  00000006 can hang its inactivity/progress counters and flag-capture win off
  "what did this move do" without a rewrite. This story does **not** implement
  those counters; it must merely not bury the information.
- **Recording is unchanged.** Attacks are recorded in the same plain `A2A3` form
  — **no combat markers**, no extended result notation. Per rules §4.4 the plain
  form is sufficient because resolution is a pure function of position + rules,
  which this story guarantees. `renderGameRecord` needs no format change.
- **One interaction path.** Attacks flow through the same
  select → destinations → activate grammar as 00000004; `activateSquare` gains
  attack handling, `activatableSquares`/`actionableSquares` gain attack targets,
  `PlayBoard` marks them distinctly. There is no new mouse-only path and no
  second grid.
- **"Stuck with no legal move" remains out of scope** (story 00000006). Attacks
  make it rarer; do not add logic, UI, or tests for it. Do not crash.
- **The Flag is never offered as an attack target** (see combat model above).

---

## Step 1 — Combat resolution rule logic (rank table & the non-Archer special cases)

Status: committed

Notes: Added `src/rules/primary/v1_1/combat.ts` exporting `CombatResult`,
`CombatOutcome`, and `resolveCombat(board, from, to)`, implementing the full
ruleset-1.1 rank table plus the Knight-charge, Assassin (both directions,
including Assassin-vs-Assassin and the Tower exception), and Sapper-vs-Tower
special cases, with `archerSupport` hardcoded `false` pending Step 2. Added
`src/rules/primary/v1_1/combat.test.ts` (17 cases) covering every scenario
listed in the step's verification. No deviations from the plan: charge
distance is computed locally in `combat.ts` (mirroring `movement.ts`'s own
`COLUMN_INDEX`/`step` pattern rather than importing it, since `movement.ts`
does not export those helpers) but the interface/behavior matches the plan
exactly. `npm run typecheck`, `npm run lint`, and `npm test` all pass (167
tests, 14 files).

Add a new versioned module `src/rules/primary/v1_1/combat.ts` (pure, no React)
that resolves an encounter. It exposes:

- A `CombatOutcome` value describing a resolved encounter. It must carry enough
  for the UI announcement (Step 6) and for story 00000006 without a rewrite: the
  **result** as one of three cases (attacker wins / attacker loses / mutual
  loss), the **attacker** and **defender** `PlacedPiece`s (side + type), the
  **attacked square** (the defender's square), a flag for **whether a defender
  fell** (a "capture" — true when attacker wins or mutual loss), and a flag for
  **whether Archer support fired** (always `false` in this step; the Archer layer
  is Step 2). Keep the shape a discriminated union or an equivalently clear
  record so 00000006 can pattern-match on the result.
- A `resolveCombat(board, from, to)` that returns the `CombatOutcome` for the
  side-to-move's piece on `from` attacking the enemy piece on `to`. It infers
  whether the attack is a **charge** from the geometry (attacker is a Knight
  **and** the straight-line distance from `from` to `to` is ≥ 2) — callers do not
  pass a charge flag.

Implement the full ruleset-1.1 table **except Archer support** (Step 2):

- **Two numbered pieces** (both `rankCode` a number): lower number wins; **equal
  rank → mutual loss**.
- **Knight-vs-Knight:** a **charge** (distance ≥ 2) → **attacker wins**; an
  **adjacent** (distance 1) attack → **mutual loss** (this overrides the "equal
  rank → mutual" default only in the charge direction).
- **Assassin as attacker:** **always wins** (defender removed), **including
  Assassin-vs-Assassin** — _except_ attacking a **Tower**, where the Assassin is
  destroyed and the Tower stands (attacker loses). The Assassin's guaranteed win
  does not extend to Towers.
- **Assassin as defender** (a non-Assassin numbered piece, or a Sapper, attacks
  an Assassin): **attacker wins** (the Assassin always loses when attacked).
- **Tower as defender:** **only a Sapper** destroys it (Sapper wins and
  advances); **any other attacker** → **attacker loses** (Tower stands).
- **The Flag never reaches this function** (it is never offered as a target); no
  Flag-defender case is needed. Towers never attack (immobile), so no
  Tower-attacker case is needed.

State that this module reads ranks from `PIECE_CATALOG[type].rankCode` and that
"charge distance" is the count of squares between `from` and `to` along their
shared row or column (they are always colinear for a legal attack; Step 3
guarantees only legal `from`/`to` pairs reach here, and this is a
programming-invariant function like `applyMove`).

Depends on: nothing new — builds on `board.ts`, `pieces.ts`, and `BoardState`
from `gameState.ts`.

Verification (automated): Add `src/rules/primary/v1_1/combat.test.ts` and run
`npm test`. On hand-built `BoardState` fixtures, assert every case: lower rank
beats higher (both attack directions — win and sacrifice); equal rank → mutual
loss for a couple of ranks; Knight charge vs Knight → attacker wins; adjacent
Knight vs Knight → mutual loss; adjacent Knight vs Halberdier → attacker wins
(rank 3 over 5); Assassin attacking a numbered piece, a stronger piece, and
another Assassin → all attacker wins; Assassin attacking a Tower → attacker
loses; a numbered piece and a Sapper attacking an Assassin → attacker wins;
Sapper vs Tower → attacker wins; non-Sapper (e.g. Militia, Champion) vs Tower →
attacker loses; and that the outcome's attacker/defender/attacked-square/capture
fields are populated correctly, with `archerSupport` always `false`.

---

## Step 2 — Archer defensive support (combat resolution override)

Status: committed

Notes: Extended `resolveCombat` in `src/rules/primary/v1_1/combat.ts` with an
`archerSupportFires` helper and a `squareBeyond` geometry helper (computing the
trigger square from the attacker's unit direction of travel, mirroring
`movement.ts`'s own `step` pattern rather than importing it, consistent with
Step 1's precedent). When the base result is `attackerWins`, support flips the
result to `mutualLoss` and sets `archerSupport: true`; the supporting Archer is
never removed. Added 11 cases to `combat.test.ts` (28 total) covering every
scenario in the step's verification: ordinary 1-square, charge (distance 2),
and rush (distance 3) support geometry; a supported Tower trading with a
Sapper; an attacking Assassin not immune; and five "does not fire" cases
(off-line Archer, off-board trigger square, lake trigger square, Archer of the
attacker's own side, and base results that were already attacker-loses or
mutual). No deviations from the plan. `npm run typecheck`, `npm run lint`, and
`npm test` all pass (178 tests, 14 files).

Extend `src/rules/primary/v1_1/combat.ts` so `resolveCombat` applies the
**Archer defensive support** override on top of Step 1's base result. Support
only matters when the base result was **attacker wins** (the defender is losing a
defensive combat); when it fires, the result becomes **mutual loss** (the
attacker is also removed) and the outcome's **`archerSupport` flag becomes
`true`**. The supporting Archer is a bystander and is **not** removed.

Support fires exactly when **all** hold:

- the base result is **attacker wins**;
- the **trigger square** — the square **one step beyond the defender, continuing
  the attacker's exact straight line of travel** (i.e. defender square plus the
  attacker's unit direction vector; the same geometry whether the attack was a
  1-square step, a 2–3 square charge, or a rush) — is **on-board** and **not a
  lake**;
- the trigger square holds an **Archer** belonging to the **defender's** side.

It does **not** fire otherwise: no friendly Archer there, the Archer off the
attack line, the trigger square off-board or a lake, or the base result already
attacker-loss / mutual. Confirm from the story's list that support **extends to
Towers** (a supported Tower vs a Sapper → mutual: both fall) and that an
**attacking Assassin is not immune** (a supported defender vs an attacking
Assassin → mutual: the Assassin also falls) — both follow automatically because
each was an "attacker wins" base result that support flips to mutual. Support is
**defensive only**: it is evaluated from the defender's side, so it never helps a
piece that is itself attacking.

Depends on: Step 1 (base resolution and the `CombatOutcome` shape it defines).

Verification (automated): Extend `combat.test.ts` and run `npm test`. Assert:
an ordinary 1-square attack where the defender has a friendly Archer directly
behind (on the attacker's line) → mutual loss with `archerSupport` true; the same
geometry for a **charge** and a **rush** from distance (trigger square is one
beyond the defender along the travel line) → mutual loss; a **supported Tower**
attacked by a **Sapper** → mutual loss (both fall); an **attacking Assassin**
against a supported defender → mutual loss; and **no** support when the Archer is
adjacent to the defender but **off** the attack line, when the trigger square is
off-board or a lake, when the piece behind is an Archer of the **attacker's**
side, and when the base result was not attacker-wins (attacker-loss and mutual
cases are unaffected).

---

## Step 3 — Attack-target rule logic (`legalAttacks`)

Status: committed

Notes: Added `legalAttacks(board, origin)` to `src/rules/primary/v1_1/movement.ts`
alongside the unchanged `legalDestinations`, plus two private helpers
(`maxAttackDistance`, `isLegalAttackTarget`) that mirror `legalDestinations`'s
existing ray-walk shape (reusing `step` and `ORTHOGONAL_DIRECTIONS`): each
direction is walked out to the piece's max attack distance (1 for baseline
pieces, 3 for Knight and Skirmisher), stopping at the first lake or occupied
square, and offering that square as a target only if it holds an enemy,
non-Flag piece — with the Knight's extra restriction that a blocker at
distance ≥ 2 (a charge) may not be a Halberdier. Added 19 cases to
`movement.test.ts` (34 total) covering every scenario in the step's
verification. No deviations from the plan.
`npm run typecheck`, `npm run lint`, and `npm test` all pass (194 tests, 14
files); `npm run format:check` was also run and `movement.ts`/`movement.test.ts`
were reformatted with `prettier --write` to match repository style.

Extend `src/rules/primary/v1_1/movement.ts` (pure, no React) with a
`legalAttacks(board, origin)` that returns the enemy-occupied squares the piece
on `origin` may **legally attack**, keyed in the absolute White frame. Keep
`legalDestinations` (empty-square moves) unchanged — the two functions are
deliberately distinct so the UI can mark attacks apart from moves.

Rules for a target square to be offered:

- It must hold an **enemy** piece (a piece of the other side). **Never** a
  friendly piece; **never** an empty square; **never** a **Flag** (a Flag square
  is never offered — the Flag is not attackable in this story).
- **Tower and Flag as attackers:** no attack targets (immobile). An empty origin:
  none.
- **Baseline pieces** (everything except Skirmisher and Knight, i.e. Lord
  Marshal, Champion, Infantry, Halberdier, Militia, Archer, Sapper, Assassin):
  the **orthogonally adjacent** (1 square) enemy piece in each of the four
  directions, if on-board.
- **Knight:** an **adjacent** (1-square) enemy in any orthogonal direction is an
  ordinary attack and **is** offered (including onto a Halberdier). Additionally,
  a **charge**: a square **2 or 3** away in a straight orthogonal line whose
  **intervening squares are all clear** (no piece of either side, no lake) and
  that holds an enemy — **but never a Halberdier** (a Knight may not charge a
  Halberdier). A charge target is only ever an **enemy-occupied** square, never an
  empty one (a Knight's non-attacking move stays 1 square, per 00000004).
- **Skirmisher (rush attack):** an enemy up to **3** squares away in a straight
  orthogonal line whose intervening squares are all clear (no piece, no lake).
  Any enemy type is a valid rush target (including a Halberdier).
- Never diagonal; never off-board; a ray is blocked by the first lake or piece —
  and if that first blocker is a valid enemy target at a legal distance, it is
  the attack target (and the ray stops there; nothing beyond it is reachable).

You may reuse the module's existing `step` helper and orthogonal-direction
deltas. This module knows nothing about screen orientation or React.

Depends on: nothing new beyond `board.ts`/`pieces.ts`/`BoardState`; sits beside
`legalDestinations`. Comes before the play/session layers that consume it.

Verification (automated): Add cases to `src/rules/primary/v1_1/movement.test.ts`
(or a colocated file) and run `npm test`. Cover, on hand-built fixtures: a
baseline piece offered exactly its adjacent enemy squares (friendly-adjacent and
empty-adjacent excluded; an adjacent **Flag** excluded); a Knight offered an
adjacent enemy **and** a 2- and 3-square charge over a clear line, but **not**
onto an empty square, **not** through a blocker or lake, and **not** onto a
Halberdier at charge distance (while the same Halberdier **is** offered when
adjacent); a Skirmisher offered enemies at 1/2/3 in a clear line and cut short by
a lake and by a piece in the path; Tower and Flag origins yielding no attacks;
and no diagonal target ever appearing.

---

## Step 4 — Apply attacks in the play state and expose the outcome

Status: committed

Notes: Extended `applyMove` in `src/rules/primary/v1_1/play.ts` to accept a
destination among `legalAttacks` (Step 3) in addition to `legalDestinations`,
resolving an attack via `resolveCombat` (Steps 1-2) and updating the board per
the outcome (attacker wins removes the defender and advances the attacker;
attacker loses removes the attacker; mutual loss removes both). The side
still flips and the ply is still appended in the plain `A2A3` form with no
combat markers in every case. `applyMove`'s signature changed from returning
`PlayState` to returning `{ state: PlayState; outcome: PlyOutcome }`; a new
exported discriminated union `PlyOutcome` was added
(`{ kind: "attack" } & CombatOutcome` for a resolved attack, or
`{ kind: "move"; piece: PlacedPiece; square: Square }` for a plain move with
no attacker/defender/capture to report) so callers can pattern-match on
`kind`. The illegal-move throw is preserved, now triggered when `to` is
neither a legal destination nor a legal attack target. Updated
`src/board/playSession.ts`'s sole call site to unwrap `.state` (its own
behavior is otherwise unchanged - it does not yet offer attacks; that is
Step 5's job) so the build stays green per the plan's instruction. Extended
`src/rules/primary/v1_1/play.test.ts` with an `attacks` sub-describe covering
all three outcomes, the outcome's exact shape (including `archerSupport`),
no-mutation of the input state, plain-`A2A3` rendering of an attack in
`renderGameRecord`, and an illegal-target throw; updated existing move tests
for the new `{ state, outcome }` return shape. No behavioral deviations from
the plan; the `PlyOutcome` union shape was a judgment call within the plan's
"recommended shape ... or an equivalently clear record" latitude, chosen
because `CombatOutcome`'s fields are all non-optional and can't represent "no
defender, no capture" without an artificial value. `npm run typecheck`,
`npm run lint`, `npm test` (200 tests, 14 files), and `npm run format:check`
all pass (prettier reformatted `play.ts` after the edit, no content change).

Extend `src/rules/primary/v1_1/play.ts` so move application handles **attacks**
as well as plain moves, and **exposes the resolved outcome** to callers.

- Broaden the legality accepted by move application so a destination that is
  among **`legalAttacks(state.board, from)`** (Step 3) is legal in addition to
  `legalDestinations`. (An enemy-occupied square is never in `legalDestinations`,
  so the two sets are disjoint.)
- When the destination is an **attack** target, resolve it via
  `resolveCombat(state.board, from, to)` (Steps 1–2) and update the board per the
  outcome: **attacker wins** → remove the defender, move the attacker onto the
  square; **attacker loses** → remove the attacker, leave the defender in place;
  **mutual loss** → remove both, leave the square empty. When the destination is
  a plain **move** (empty target), behave exactly as before (relocate the piece).
- In every case the side to move **flips** and the move is appended to `moves` in
  the same plain **`A2A3`** form (`squareKey(from) + squareKey(to)`) — **no combat
  markers**. `renderGameRecord` needs no change.
- **Expose the outcome.** Provide a way for callers to obtain the `CombatOutcome`
  (Step 1) produced by the ply — for a plain move, a "just a move" outcome (no
  defender, no capture). The recommended shape is a single function that returns
  both the new `PlayState` and the outcome (e.g. `{ state, outcome }`), so the
  session layer (Step 5) can store it for the announcement and story 00000006 can
  consume it. Preserve the existing throw-on-illegal-move invariant (a
  destination in neither `legalDestinations` nor `legalAttacks`, or a `from` not
  holding the side-to-move's piece, throws — the UI never offers such a move).
  Update `playSession.ts`'s call site to match the new signature in Step 5; keep
  `renderGameRecord` and `startPlay` working. If you keep the old `applyMove`
  name/return for a plain `PlayState`, ensure the outcome is still retrievable —
  do not silently drop it.

Depends on: Steps 1–2 (`resolveCombat`, `CombatOutcome`), Step 3
(`legalAttacks`), and 00000004's `play.ts`.

Verification (automated): Extend `src/rules/primary/v1_1/play.test.ts` and run
`npm test`. Assert, on fixtures built so each outcome occurs: attacking a weaker
piece removes the defender and advances the attacker (origin empty, target now
holds the attacker), flips the side, and appends the correct `A2A3`; attacking a
stronger piece removes the attacker and leaves the defender; an equal-rank attack
empties the square (both removed); each returns the correct `CombatOutcome`
(result, attacker/defender, capture flag, `archerSupport`); a plain empty-square
move still works and yields a non-combat outcome; the input state is never
mutated; `renderGameRecord` still renders attacks as plain `A2A3`; and an illegal
target still throws.

---

## Step 5 — Session layer: offer attacks, distinguish them, carry the outcome

Status: committed

Notes: Extended `src/board/playSession.ts`: `isOwnMovablePiece` now also
checks `legalAttacks`; `actionableSquares`/`activatableSquares` union in
`legalAttacks(play.board, selection)` alongside `legalDestinations`; added a
new exported `attackTargets(session)` accessor returning `legalAttacks` for
the current selection (`[]` when nothing is selected); `activateSquare`
matches a target against destinations _or_ attacks and, either way, applies
it via `applyMove` (unwrapping `{ state, outcome }`), flips the side, and
clears the selection; `PlaySession` gained a `lastOutcome: PlyOutcome | null`
field (`null` from `startSession`), overwritten with the ply's `PlyOutcome`
whenever `activateSquare` applies a move or an attack, and left unchanged on
every other transition (select/deselect/switch-selection/no-op). Updated the
existing "stuck" test, whose old fixture (a lone piece boxed in by enemies)
no longer represents "stuck" now that a boxed-in piece can attack every
adjacent enemy — replaced it with friendly Towers on all four sides so the
piece truly has neither a legal move nor a legal attack, matching the step's
own verification bullet ("a side with neither move nor attack yields an
empty actionable set without throwing"). Added new describe blocks to
`src/board/playSession.test.ts` covering: a piece with only an attack
selectable; attack targets present in `actionableSquares`/
`activatableSquares` and isolated by `attackTargets`, distinct from move
targets; `attackTargets` empty with nothing selected; friendly-occupied and
Flag squares never offered as attack targets (Flag case also confirms the
piece's plain-move destinations remain unaffected); activating an attack
target applying the attack, flipping the side, clearing the selection, and
recording the exact resolved `CombatOutcome` on `lastOutcome` (both an
attacker-wins and a mutual-loss case); a plain move recording a `{ kind:
"move", ... }` outcome; and a mixed move-then-attack sequence confirming
turns still strictly alternate and both plies' outcomes are captured
correctly. One deviation from the plan's literal wording: the plan describes
`lastOutcome` as carrying "the most-recent resolved `CombatOutcome`", but its
own type is only meaningful for attacks (`{ kind: "move", piece, square }`
plain moves have no attacker/defender to report) — used Step 4's
already-defined `PlyOutcome` union instead (`CombatOutcome` tagged with `kind:
"attack"`, or the plain-move variant), which is what `applyMove` already
returns and is exactly what Step 6's announcement needs to discriminate an
attack from a plain move without re-deriving it from the move-count diff.
`npm run typecheck`, `npm run lint`, `npm test` (209 tests, 14 files),
`npm run format:check`, and `npm run build` all pass.

Extend `src/board/playSession.ts` (pure, no React) so the turn/selection state
machine offers **attacks alongside moves**, keeps them **distinguishable**, and
**carries the resolved outcome** for the announcement layer.

- Treat a piece as selectable (an "own movable piece") if it has **any** legal
  move **or any** legal attack (extend `isOwnMovablePiece` to consider
  `legalAttacks` too, so a piece that can only attack is still offerable).
- When a piece is selected, the **actionable/highlighted** targets are its
  legal moves **plus** its legal attacks (extend `actionableSquares`); the
  **activatable** set (which cells respond to click/Enter) likewise includes
  attack targets (extend `activatableSquares`). Expose which of the selected
  piece's targets are **attacks** vs plain **moves** so `PlayBoard` (Step 7) can
  render them differently — e.g. an `attackTargets(session)` (or an equivalent
  split) returning the attack subset.
- `activateSquare`: activating one of the selected piece's **attack** targets
  applies the attack (via Step 4's move application), flips the side, and clears
  the selection — exactly as it already does for a move target. Deselect and
  switch-selection behavior are unchanged.
- **Carry the outcome.** Add the most-recent resolved `CombatOutcome` to
  `PlaySession` (e.g. a `lastOutcome` field, `null` before any ply), set by
  `activateSquare` whenever a ply is applied and left/cleared otherwise, so
  Step 6's announcement can describe the encounter from the post-activation
  session. (This mirrors how `describeActivation` already diffs before/after.)
- The "stuck with no legal move" case stays out of scope — with both moves and
  attacks now considered, `actionableSquares` simply returns empty if a side has
  neither; no crash, no special handling.

Depends on: Step 3 (`legalAttacks`), Step 4 (attack application + outcome), and
00000004's `playSession.ts`.

Verification (automated): Extend `src/board/playSession.test.ts` and run
`npm test`. Assert: selecting a piece that can attack exposes its attack targets
in the actionable/activatable sets and in the attack-subset accessor, distinct
from its move targets; a piece that can **only** attack is still selectable;
activating an attack target applies the attack, flips the side, clears the
selection, and records the resolved outcome on the session; a friendly-occupied
square and a Flag square are never offered as targets; turns still strictly
alternate; and a side with neither move nor attack yields an empty actionable set
without throwing.

---

## Step 6 — Combat announcement wording

Status: pending

Extend `src/board/playAnnouncement.ts` (pure, no React) so
`describeActivation(before, after, square)` announces **combat outcomes** in
player-facing terms, extending the existing selected/moved/deselected wording.
When the ply just applied was an **attack** (detectable from the session's
carried outcome, Step 5), the sentence must convey, using **Red/Blue** and piece
`displayName`s:

- **which pieces fought** (attacker and defender, by color + name);
- **who fell** — attacker wins (defender falls, attacker advances), attacker
  loses (attacker falls), or mutual loss (both fall);
- **whose turn it now is** (as the movement announcements already append) — this
  remains the single place turn information is pushed to assistive technology.

Keep the existing non-combat wording for plain moves, selection, and deselection.
Phrasing is the plan author's judgment; it must be unambiguous when read across a
hot-seat hand-off (a player who did not see the board change can tell what
happened). Optionally mention Archer support when it fired (the outcome flag is
available), but do not overload the sentence.

Depends on: Step 5 (the session carries the resolved outcome). No UI change here.

Verification (automated): Extend `src/board/playAnnouncement.test.ts` and run
`npm test`. Assert the announcement for each of the three outcomes names the two
combatants by color + piece name and states who fell and whose turn it now is,
and that plain-move / selection / deselection wording is unchanged.

---

## Step 7 — Board & app wiring: attack targets shown, activated, and announced

Status: pending

Wire the full visible feature. In `src/board/PlayBoard.tsx` (+ `PlayBoard.css`),
using the session's attack-subset accessor from Step 5:

- Mark a selected piece's **attack targets** as actionable/activatable (they
  already come through `activatableSquares`) **and render them visually distinct
  from plain move targets** — a distinct highlight class (do not reuse
  `--destination`, which means a plain move; add e.g. `--attack`), styled so a
  sighted player can tell an attack target from a move target before committing.
  Keep the keyboard-focus ring distinct from both (00000004 reserves the amber
  border for focus).
- Extend each attack target cell's **accessible label** so a screen-reader user
  can tell it is an attack and on what (e.g. its square name plus "attack {enemy
  color} {enemy piece name}"), distinct from a plain move target's label. Plain
  move targets and non-target cells keep their 00000004 labels.

No change is needed in `src/App.tsx`'s activation routing beyond confirming it
still works: `handlePlayActivate` already calls `activateSquare` then
`describeActivation`, both of which now understand attacks; the combat
announcement flows to the board's live region unchanged. Confirm the developer
`GameRecord` dump still renders (attacks appear as plain `A2A3`).

At the end of this step, attacking is fully operable end-to-end: enemy targets in
reach are offered and distinguished, choosing one resolves combat and updates the
board, and the outcome is presented. This step's gate verifies **basic attacks
and rank resolution**; the special cases are exercised in Steps 8–10.

Depends on: Steps 3–6 (attack targets, resolution, session, announcement) and
00000004's `PlayBoard`/`App` wiring.

Verification (manual — **Gate A**): Run `npm run dev`, complete a Phase-1 setup
for both sides (Auto-fill + Confirm each), and enter Phase 2. Confirm:
enemy-occupied squares in a selected piece's reach are **offered as attack
targets and visually distinguished from plain moves**; **friendly** pieces and
the **Flag** are **never** offered; attacking a **weaker** piece **wins and
advances**, attacking a **stronger** piece is a **complete sacrifice** (attacker
removed, defender stays), and **equal rank** is **mutual loss** (both removed) —
with the board updating correctly in all three and the **outcome clearly
presented** (which pieces fought, who fell). (You may need to set up specific
adjacencies via the placement phase to stage these; sacrificial attacks are
always legal, so any piece can be sent against any enemy.)

---

## Step 8 — Knight charge, Halberdier anti-charge, Knight-vs-Knight (Gate B)

Status: pending

The rule logic for the Knight charge (Step 3 `legalAttacks`: 2–3 square charge
over a clear line, never onto an empty square, never through a blocker or lake,
never onto a Halberdier; adjacent 1-square attack offered normally) and its
resolution (Step 1: charge-vs-Knight wins, adjacent Knight-vs-Knight is mutual
loss, adjacent Knight-vs-Halberdier wins by rank) is already built and
unit-tested. This step **exercises it end-to-end and applies any UI polish**
needed to pass the gate (for example, ensuring a charge target reads clearly as
an attack over the intervening squares). If manual testing surfaces a defect in
the offered targets or resolution, fix it in the appropriate rule/session/board
module and record the fix in Notes; otherwise this step is verification-only, per
the 00000004 precedent where a gate step turned out to be polish-only.

Depends on: Steps 3, 7 (charge targets offered and rendered end-to-end). Uses
Steps 1, 4–6.

Verification (manual — **Gate B**): Run `npm run dev`, enter Phase 2, and stage
Knight encounters. Confirm: a Knight is offered **2–3 square destinations only
onto attackable enemy pieces over a clear straight line** — **never onto empty
squares**, **never through blockers or lakes**, and **never onto a Halberdier**;
a **charge against a Knight wins outright** (attacker advances); an **adjacent
Knight-vs-Knight** attack is **mutual loss**; and an **adjacent Knight attack on
a Halberdier wins normally** (rank 3 over rank 5).

---

## Step 9 — Skirmisher rush, Assassin, Sapper & Tower (Gate C)

Status: pending

The rule logic for the Skirmisher rush attack (Step 3), the Assassin (Step 1:
wins any attack including Assassin-vs-Assassin, loses when attacked, destroyed
attacking a Tower), and the Sapper/Tower interaction (Step 1: Sapper destroys a
Tower and advances; any other attacker on a Tower is removed while the Tower
stands) is already built and unit-tested. This step **exercises it end-to-end and
applies any UI polish** needed to pass the gate. Fix any defect surfaced by
manual testing in the appropriate module and record it in Notes; otherwise
verification-only.

Depends on: Steps 1, 3, 7. Uses Steps 4–6.

Verification (manual — **Gate C**): Run `npm run dev`, enter Phase 2, and stage
the encounters. Confirm: a **Skirmisher can attack up to 3 squares away along a
clear line** (stopped short by a piece or lake); the **Assassin wins any attack
it makes** (including against another **Assassin**) but **falls to any attack
against it**, and is **destroyed if it attacks a Tower**; a **Sapper destroys a
Tower and advances**; and **any other piece attacking a Tower is removed while
the Tower stands**.

---

## Step 10 — Archer defensive support (Gate D)

Status: pending

The Archer defensive-support resolution (Step 2) is already built and
unit-tested. This step **exercises it end-to-end and applies any UI polish**
needed to pass the gate. Fix any defect surfaced by manual testing in `combat.ts`
(or the wiring) and record it in Notes; otherwise verification-only.

Depends on: Step 2 (support resolution) and Step 7 (end-to-end combat). Uses
Steps 3–6.

Verification (manual — **Gate D**): Run `npm run dev`, enter Phase 2, and stage
Archer-support positions (a defender adjacent to a friendly Archer, the Archer one
square beyond the defender on the attacker's line of travel). Confirm the result
becomes **mutual loss** — verified for an **ordinary 1-square attack**, a
**charge or rush from distance**, a **supported Tower** (Sapper trades — both
fall), and an **attacking Assassin** (not immune — both fall). Confirm there is
**no support** when the Archer is adjacent but **off** the attack line, and when
the piece the Archer stands behind is the one **attacking** (support is defensive
only).

---

## Step 11 — Accessible combat (Gate E)

Status: pending

Accessibility is built into Steps 5–7 (attacks flow through the same accessible
grid as movement — there is no separate mouse-only attack path; attack targets
are activatable by keyboard and labeled as attacks; combat outcomes are
announced through the live region via Step 6). This step is the dedicated
accessibility gate plus any small polish needed to pass it — adjust attack-target
labels, focus styling, or announcement strings as needed and record changes in
Notes.

Depends on: Steps 5, 6, 7 (accessible attack targets and combat announcements).

Verification (manual — **Gate E**): Run `npm run dev`, enter Phase 2, and — **with
the mouse put away** — make a full attack **by keyboard alone**: Tab to the board,
arrow to one of your pieces, Enter/Space to select, arrow to an enemy target,
Enter/Space to resolve. Confirm **attack destinations are announced as attacks**
(distinct from plain moves), the **combat outcome — who fought, who fell — is
announced** to a screen reader (e.g. NVDA, VoiceOver, or Orca), and **focus
remains visible and untrapped** through the resolution (you can Tab away from the
board).

---

## Step 12 — Move record with attacks (Gate F)

Status: pending

Attacks are recorded in the same plain `A2A3` form with no combat markers
(Step 4) and `renderGameRecord` (00000004) surfaces them in the developer
`GameRecord` dump unchanged. This step **verifies** that a game mixing moves and
attacks records correctly and remains replay-sufficient. It is verification-only
unless a defect is found (fix and note it).

Depends on: Steps 4, 7 (attacks applied and recorded, dump surfaced). Uses
00000004's `renderGameRecord`/`GameRecord`.

Verification (manual — **Gate F**): Run `npm run dev`, enter Phase 2, and play a
sequence including plain moves and attacks of **each** outcome type (attacker
wins, attacker loses, mutual loss). Open the developer game-record dump and
confirm it records **every ply in the plain `A2A3` form** (no combat markers)
with the **ruleset version** (`PRIMARY:1.1`), and that **replaying those plies
mentally against the rules reproduces the board shown** — confirming the record
remains sufficient for future replay.

---

## Step 13 — README accuracy check

Status: pending

Review `README.md` against this story's changes and update it if warranted (the
`/update-readme` command automates this against the branch diff). After
00000004, the README says players can move pieces but that attacks, capturing,
and winning are still to come. Now that Phase-2 **combat** (attacks and capture
resolution — but **not** game-end) ships, update the player-facing wording to say
players can now attack and capture, while making clear that **winning, losing,
and drawing** are still to come (story 00000006). Use player-facing language
(Red/Blue, "move"). If, on review, no change is warranted, record that conclusion
in Notes.

Depends on: all prior steps (the README describes the delivered behavior).

Verification (automated): Run `npm run typecheck`, `npm run lint`, and
`npm test` and confirm all pass; then re-read `README.md` and confirm every
statement it makes about what the app can do matches the shipped behavior (or was
updated to match).
