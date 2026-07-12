# Implementation Plan — Story 00000006: Phase 2 game-end (victory, draws & losses)

This plan finishes Phase 2. It builds **directly on stories 00000004 (movement)
and 00000005 (combat)**, which delivered the versioned `PlayState`,
`legalDestinations`/`legalAttacks`, `resolveCombat`/`CombatOutcome`, `applyMove`
and its exposed `PlyOutcome`, the pure turn/selection state machine
(`playSession.ts`), the live-region announcement layer (`playAnnouncement.ts`),
the perspective-flipping accessible board (`PlayBoard.tsx`), and the
developer-facing game-record dump. **Game-end extends that model — it must not
fork it.** No parallel game-state model, no second interaction pattern, no
second board renderer.

Read `story.md` in this folder first. This plan assumes the implementer of any
step has read only `story.md`, this plan, and their own step — every fact a step
needs is stated below. **Do not re-read the companion rules documentation**: the
story states that no re-check is needed, and the "Grounding facts" section below
records every ruleset fact and every reference-engine semantic this story
depends on (these were confirmed against the companion repository at plan time —
see "Plan-time confirmations").

---

## Grounding facts (from the story, the companion repository, and this codebase)

### Ruleset

Game-end detection, structural reachability, and the two counters are **rule
logic and rule state**, and live with the other per-version rule logic under
`src/rules/primary/v1_1/`, tagged `RULESET_TAG = "PRIMARY:1.1"` (in
`gameState.ts`), consistent with stories 00000001/00000004/00000005.

### The game-end model to implement (ruleset 1.1)

- **§6 preamble — the game ends the moment any condition is met.**
- **§6.1 Flag capture.** Moving a piece onto the opposing Flag wins immediately.
  The Flag is **never Archer-supported** (an Archer directly behind the Flag
  changes nothing), and an **Assassin attacking a Flag wins outright**. Flag
  capture is combat's simplest case: the attacker always wins, no rank
  comparison, no support.
- **§6.2 Unbreachable Flag.** A player **wins immediately** when **both** hold:
  (1) every one of the **opponent's** Sappers is *unavailable* — captured, or
  currently unable to structurally reach any of **this player's** Towers; and
  (2) **this player's own Flag is fully enclosed** by intact Towers and the
  board edge, so no non-Sapper enemy piece could ever reach it. Enclosure can
  only degrade (Towers never move or appear), availability is re-checked
  continuously against the current board, and **if both sides meet the condition
  at once, the game is a draw**. Because placement is unrestricted, this can
  hold **at the reveal**, before any ply — so detection must also run once at
  the start of Phase 2.
- **§5 Structural reachability** (the notion §6.2 uses). One square structurally
  reaches another when a path of single **orthogonal** steps connects them,
  treating **lakes and every intact Tower and Flag of either side** as
  **impassable walls**, and **ignoring all mobile pieces**.
- **§6.3 No legal move.** A player who has no legal ply at all on their turn
  (no legal move *and* no legal attack, with any of their pieces) **loses
  immediately**. Passing is never allowed.
- **§6.4 Inactivity.** Each player has a personal counter starting at 0. **Any
  attack you make** — winning, trade (mutual loss), or sacrifice — resets **your**
  counter to 0. Any **non-attack move** of yours raises **your** counter by 1.
  Any **sacrificial attack by your opponent** — complete (their attacker falls,
  yours survives) or partial (mutual loss) — also resets **your** counter to 0.
  At **50**, that player **loses immediately**.
- **§6.5 No progress.** A single **shared** counter starts at 0 and rises by 1 on
  every ply in which **no piece is captured**; **any capture** — a winning attack
  or a mutual loss, including a Sapper destroying a Tower — resets it to 0. A
  complete sacrifice captures nothing and does **not** reset it. At **80**, the
  game is a **draw**.
- **§6.6 Draw by agreement.** Either player may offer a draw **on their turn**;
  if the opponent accepts, the game ends immediately in a draw. If declined, the
  offering player **takes their turn as usual** — an offer never replaces or
  skips a move. Declining is quiet: no penalty, no record entry.

### Evaluation precedence (a rules-fidelity requirement, not a design choice)

Recorded games must replay to the same result in this codebase and in the
companion repository's reference engine, so detection follows the reference
engine's order **exactly**. Evaluated after every ply (and once at the start of
Phase 2), from the perspective of the **active player** — the side whose turn it
now is:

1. **§6.1 Flag capture** — if the active player's Flag is gone, the active
   player **loses**; if the opponent's Flag is gone, the active player **wins**.
   (A "does this side still have a Flag on the board" check, not a check of what
   the last ply did.)
2. **§6.2 Unbreachable Flag** — compute both sides' conditions. If **both** hold,
   **draw**; otherwise the side whose condition holds **wins**.
3. **The opponent's inactivity loss (§6.4)** — if the **opponent's** counter has
   reached 50, the active player **wins**.
4. **The shared no-progress draw (§6.5)** — if the progress counter has reached
   80, **draw**.
5. **§6.3 No legal move** — if the active player has no legal ply, the active
   player **loses**.
6. **The active player's own inactivity counter at 50** — the active player
   loses. (Unreachable in normal play, since that counter only advances on the
   active player's own plies and would have ended the game at the close of their
   previous turn; implement it anyway, for completeness.)

Steps 3–4 deliberately precede step 5: they are attributable to the **opponent's
just-completed ply**, and the game ends the moment that ply meets them, before
the active player is ever asked to move. A single non-attack ply that reaches 50
inactivity **and** 80 progress at once therefore resolves as the **inactivity
loss** (6.4 precedes 6.5).

### Reference-engine reachability semantics (confirmed at plan time)

These are the operational definitions the reference engine uses
(`capture_the_flag/reachability.py`), and the ones to implement:

- **Blocked squares** (the walls for *both* checks): every **lake** square, plus
  every square holding an intact **Tower or Flag of either side**. All mobile
  pieces are **ignored** (they never block, and they are never blocked by other
  mobile pieces) — because a mobile piece's legal movement is blocked by exactly
  those same walls, the connected region a piece stands in can change only when
  a Tower is destroyed.
- **Flag enclosed (for side S)**: flood-fill from S's own Flag square through
  non-blocked squares (the Flag square itself is the start, even though it is
  blocked); S's Flag is **enclosed** iff the resulting connected region contains
  **no square of the opponent's home zone**. (Home zones: `isHomeSquareFor` in
  `board.ts` — White rows 1–4, Black rows 9–12.) This is the operational form of
  "no non-Sapper enemy piece could ever reach it".
- **Sappers available (for side S)**: **true** iff at least one of S's Sappers can
  structurally reach at least one **opponent Tower**, where the target Tower
  square counts as reachable even though it is itself a wall (a Tower is a wall to
  move *through*, not to arrive *at*). A side with **no Sappers left** has none
  available.
- **Side S wins by §6.2** iff `S's own flag enclosed` **and** `not (opponent's
  sappers available)`.

### Record file format (confirmed at plan time against the companion repository's `doc/ruleset/technical-notes.md`)

- Header tags use PGN syntax `[Name "value"]`, one per line. `Result` and
  `Ruleset` are **always written**.
- `Result` uses PGN values: **`1-0`** (White wins), **`0-1`** (Black wins),
  **`1/2-1/2`** (draw), **`*`** (ongoing/unknown). Note White = Side A = **Red**,
  Black = Side B = **Blue** (the record uses White/Black; the *UI* uses
  Red/Blue).
- `ResultReason` is free text. The technical notes' own examples are the strings
  to use: **`Flag Captured`**, **`Unbreachable Flag`**, **`No Legal Move`**,
  **`Inactivity`**, **`No Progress`**. The notes give no example for an **agreed
  draw**; the **owner has fixed it as `Agreement`** (2026-07-11), matching the
  one-word style of the confirmed strings. This string is *not* in the companion
  repository's notes and is to be raised upstream so both codebases agree.
- **`ResultReason` is omitted entirely while a game is ongoing** (owner's
  decision, 2026-07-11): an ongoing record carries `[Result "*"]` and **no**
  `ResultReason` tag. The tag appears only once the game has ended.
- The move sequence keeps the **plain `A2A3` form** (owner's decision, 2026-07-11
  — the extended result-marking form is a separate later story). Draw offers and
  declines are **not recorded** in the move sequence; an agreed draw appears only
  in the `Result`/`ResultReason` tags.

### Repository facts to build on (reuse, do not rebuild)

Rule layer, `src/rules/primary/v1_1/`:

- `board.ts` — `Column`, `Row`, `Side` (`"white" | "black"`), `Square`,
  `squareKey`, `allSquares`, `isLake`, `isHomeSquareFor`, `homeSquares`,
  `COLUMNS`, `ROWS`.
- `pieces.ts` — `PieceTypeId`, `PIECE_CATALOG` (`displayName`, `rankCode`,
  `symbol`, `quantityPerSide`). Relevant quantities per side: **8 Sappers**,
  **6 Towers**, **1 Flag**.
- `gameState.ts` — `RULESET_TAG`, `PlacedPiece` (`{ side, pieceType }`),
  `BoardState` (`Readonly<Record<string, PlacedPiece>>`, keyed by absolute
  `squareKey`; absent key = empty square), `InitialGameState`,
  `renderPositionBlock`.
- `movement.ts` — `legalDestinations(board, origin)` (empty-square moves),
  `legalAttacks(board, origin)` (enemy-occupied attack targets: adjacency,
  Knight charge 2–3 over a clear line but never onto a Halberdier, Skirmisher
  rush up to 3), and `hasAnyLegalNonAttackMove(board, side)` (a dead,
  caller-less API whose own doc comment defers an attack-aware version to this
  story). Private helpers: `step`, `ORTHOGONAL_DIRECTIONS`, `isImmobile`,
  `isLegalAttackTarget`. **`legalAttacks` currently excludes the Flag** — Step 2
  changes that.
- `combat.ts` — `CombatResult` (`"attackerWins" | "attackerLoses" |
  "mutualLoss"`), `CombatOutcome` (`result`, `attacker`, `defender`, `square`,
  `capture` — true when the **defender fell**, i.e. attacker-wins or mutual-loss
  — and `archerSupport`), and `resolveCombat(board, from, to)`. **No Flag
  defender case exists yet** — Step 2 adds it.
- `play.ts` — `PlayState` (`ruleset`, `initialBoard`, `board`, `sideToMove`,
  `moves: readonly string[]`), `startPlay(initial)`,
  `applyMove(state, from, to) → { state, outcome }` where `outcome` is
  `PlyOutcome` = `({ kind: "attack" } & CombatOutcome) | { kind: "move"; piece;
  square }`, and `renderGameRecord(state)` (currently emits only a `[Ruleset]`
  tag, then the position block of `initialBoard`, then rounds of plain `A2A3`
  moves). `applyMove` is immutable and throws on an illegal move (a
  programming-invariant guard — the UI never offers one).

Session/UI layer, `src/board/`:

- `playSession.ts` — `PlaySession` (`{ play, selection, lastOutcome }`),
  `startSession(initial)`, `actionableSquares` (drives the **visual highlight**),
  `attackTargets` (the attack subset of the selection's targets),
  `activatableSquares` (drives which cells **respond** to click/Enter),
  `activateSquare(session, square)` (select / deselect / switch-selection /
  apply ply). Private `isOwnMovablePiece`.
- `playAnnouncement.ts` — `describeActivation(before, after, square)`, a pure
  function producing the live-region sentence for a session transition
  (selection, deselection, plain move, resolved attack), always ending a
  completed ply with "`{Red|Blue}` to move." This is the **only** place
  whose-turn information is pushed to assistive technology.
- `PlayBoard.tsx` / `PlayBoard.css` — the full 12×12 renderer through
  `AccessibleGrid`. Per cell: `content`, accessible `label` (`squareLabel`),
  `focusable`, `actionable` (from `activatableSquares`). Highlight classes:
  `--selected`, `--destination` (plain move: amber fill), `--attack` (attack
  target: red-tinted fill + `--side-a` border). The amber **border** is reserved
  for the keyboard-focus ring. Attack-target cells are labeled
  `"{square}, attack {Color} {Piece}"`. Orientation flips with
  `session.play.sideToMove` (`boardView.ts`'s `fullBoardRows` /
  `visibleColumns`).
- `grid/AccessibleGrid.tsx` — generic ARIA grid: roving tabindex, arrow-key
  navigation, Enter/Space activation, and one polite live region
  (`role="status"`, visually hidden, driven by the `announcement` prop).
- `PlayStatus.tsx` / `.css` — "Red to move" / "Blue to move" indicator (visual
  only; it deliberately does **not** announce).
- `GameRecord.tsx` — collapsed `<details>` developer dump of
  `renderGameRecord(play)` (also `console.log`ged in dev builds).
- `PlacementStatus.tsx` — the precedent for a status bar with action buttons
  (plain `<button type="button">`); `placementSession.ts` — `newSession()`, the
  Phase-1 two-player session.
- `App.tsx` — holds `session: PlacementSession`, `selection`,
  `playSession: PlaySession | null`, and `playAnnouncement: string` in `useState`.
  Phase 2 is the branch taken when `playSession !== null`; it renders
  `PlayStatus`, `PlayBoard`, `GameRecord`, and routes every cell activation
  through `activateSquare` then `describeActivation`.

### Conventions

- **Testing:** Vitest in a **`node`** environment — **no jsdom, no DOM/component
  testing library** (that gap is a deliberately deferred story:
  `doc/plan/proposed-stories/automated-accessibility-and-dom-testing.md`). Pure
  rule logic, state machines, and announcement wording get automated `*.test.ts`
  files colocated with their module. React component / ARIA / keyboard /
  screen-reader behavior is covered by this story's **manual gates**.
- **Commands:** `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run format:check`, `npm run build`, `npm run dev`.
- **Player-facing text:** sides are **Red** (White/Side A, `#a13d2b`) and **Blue**
  (Black/Side B, `#33526b`) — never "White"/"Black"; piece names come from
  `PIECE_CATALOG[...].displayName`; the word is **"move"**, never "ply". Internal
  code, tests, and this plan use "ply".

### Key design decisions (settled here so every step can assume them)

- **Detection is a pure, versioned function over inputs, not over `PlayState`.**
  A new `src/rules/primary/v1_1/outcome.ts` computes the game outcome from the
  board, the side to move, the two inactivity counters, and the progress counter
  — **plain parameters, not a `PlayState`** — so `outcome.ts` does not import
  `play.ts` (which will import it). No import cycle.
- **The counters and the current outcome live in `PlayState`.** `PlayState`
  gains the two inactivity counters, the shared progress counter, and a
  `result` field holding the current `GameOutcome` (ongoing, or a finished
  result + reason). `startPlay` computes `result` **at the reveal** (§6.2 can
  already hold); `applyMove` updates the counters and recomputes `result` after
  every ply. Everything downstream — session, UI, record — reads
  `play.result`; nothing recomputes detection for itself.
- **An agreed draw is a state transition, not a detected condition.** `play.ts`
  exposes an `agreeDraw(state)` that returns a state whose `result` is the
  agreed draw. The draw *offer/accept/decline* dance is interaction state and
  lives in `playSession.ts`, not in the rule layer.
- **The board goes inert through the existing sets.** When the game is over (or
  a draw offer is awaiting an answer), `actionableSquares` and
  `activatableSquares` return **empty** and `activateSquare` is a **no-op**. No
  new "disabled" flag threads through `PlayBoard`; cells stay `focusable` so the
  final position remains navigable and readable by keyboard and screen reader.
- **One live region owns the narrative.** The board's existing polite live region
  (driven by `PlayBoard`'s `announcement` prop) announces the ply, the game's
  end (result + reason, **in place of** the "X to move." clause), and the
  draw-offer/accept/decline transitions. `PlayStatus` and the end-of-game panel
  stay visual-only, so nothing is announced twice from two places.
- **Countdown warnings get their own polite live region.** The warnings banner is
  a separate `role="status" aria-live="polite"` region: a countdown is
  independent of the move narrative and would bloat every move sentence if
  folded in. Two distinct polite regions are legitimate ARIA and queue cleanly.
  Warnings must be perceivable **without relying on color alone** (a text label
  and/or icon, not just a red tint).
- **The end-of-game panel never covers the board.** It replaces `PlayStatus`
  **above** the board (same slot in `App.tsx`) — no modal, no overlay: the final
  position must stay visible (in-scope item 6).
- **The draw-offer prompt does not flip the board.** An offer does not change
  whose turn it is, so `sideToMove` — and therefore the board's orientation —
  is unchanged while an offer is pending. The prompt names both sides explicitly
  ("Red offers a draw. Blue, do you accept?") so the hot-seat hand-off is
  unambiguous without an orientation change.
- **New game = full reset**, offered only from the end-of-game presentation:
  fresh, empty Phase-1 placement for both players, nothing carried over.
- **Plain `A2A3` recording stands** (owner's decision); only the header tags
  change.
- **No-legal-move (§6.3) is verified by automated tests only** — it is
  practically unreachable in honest manual play (any adjacent enemy is a legal
  sacrificial attack). It gets thorough unit tests; the end-of-game presentation
  it shares with every other ending is exercised by the other gates.

### Plan-time confirmations (from the story's "Open items to resolve at plan time")

1. **`ResultReason` strings** — confirmed against the companion repository's
   `doc/ruleset/technical-notes.md`: `Flag Captured`, `Unbreachable Flag`,
   `No Legal Move`, `Inactivity`, `No Progress`. The notes have **no** example
   for an agreed draw; the owner has fixed **`Agreement`** (to be raised
   upstream). While a game is ongoing the `ResultReason` tag is **omitted**
   (owner's decision); only `[Result "*"]` is written.
2. **§5 reachability semantics** — confirmed against the reference engine
   (`reachability.py`/`breachability.py`); the exact rules are transcribed in
   "Reference-engine reachability semantics" above. Both checks share **one**
   wall set (lakes + all Towers **and Flags** of **both** sides); the Sapper
   check treats the target Tower as a valid arrival square; the enclosure check
   is "the Flag's connected region does not touch the opponent's home zone".
3. **Warning / draw-offer placement** — decided in "Key design decisions" above
   (warnings: their own live-region banner in the status area; draw offer: a
   prompt panel in the status area, board inert, no orientation flip).

---

## Step 1 — Structural reachability & the Unbreachable-Flag inputs

Status: committed

Notes: Added `src/rules/primary/v1_1/reachability.ts` exporting
`computeUnbreachableFlagInputs(board)`, returning the four-boolean
`UnbreachableFlagInputs` record (`whiteFlagEnclosed`, `blackFlagEnclosed`,
`whiteSappersAvailable`, `blackSappersAvailable`) exactly per the plan's
semantics: one wall set (lakes + intact Towers/Flags of both sides, mobile
pieces ignored), a flood-fill enclosure check from the Flag square (itself
the wall-exempt start) that fails iff the region touches the opponent's home
zone, and a BFS-per-Sapper reachability check where the opponent Tower square
counts as reached even though it is itself a wall. A side with no Flag on the
board reports `false` rather than throwing (no Flag present in these
hand-built fixtures is possible even though it can't happen in real
`BoardState`s from `buildInitialGameState`). Added
`src/rules/primary/v1_1/reachability.test.ts` covering every case the step's
verification lists (corner enclosure, one-Tower-removed non-enclosure, open
Flag, no-Flag side, both-sides independence, sealed/unsealed Sapper,
zero-Sapper side, adjacent-enemy-Tower-as-target, mobile pieces not blocking,
and a lake completing a wall). No deviations from the plan. `npm run
typecheck`, `npm run lint`, and `npm test` all pass (228 tests, 15 files);
`npm run format:check` also clean after a Prettier pass on the new test
file.

Add a new versioned module `src/rules/primary/v1_1/reachability.ts` (pure, no
React) implementing **§5 structural reachability** and the four inputs the
Unbreachable Flag condition (§6.2) needs. It exposes one function that, given a
`BoardState`, reports for **both** sides: whether that side's own **Flag is
enclosed**, and whether that side has at least one **available Sapper** (a
Sapper able to structurally reach an enemy Tower). A four-boolean record (e.g.
`whiteFlagEnclosed`, `blackFlagEnclosed`, `whiteSappersAvailable`,
`blackSappersAvailable`) is the recommended shape; any equivalently clear
structure is fine, but the four facts must be individually readable — Step 4
combines them and must be able to distinguish "both sides win → draw" from "one
side wins".

Implement exactly the semantics recorded in this plan's "Reference-engine
reachability semantics" (recorded verbatim from the reference engine so recorded
games replay identically):

- **Walls** for both checks: every lake square, plus every square holding a
  **Tower or Flag of either side**. All mobile pieces are ignored entirely.
- **Flag enclosed (side S):** breadth-first flood-fill from S's own Flag square,
  stepping only orthogonally and never entering a wall square (the Flag square
  itself is the start, even though it is a wall). S's Flag is enclosed iff the
  resulting region contains **no square of the opponent's home zone**
  (`isHomeSquareFor(square, opponent)` from `board.ts`).
- **Sappers available (side S):** true iff some Sapper of S can reach some Tower
  of the **opponent**, where the search steps orthogonally through non-wall
  squares but the **target Tower square itself counts as reached** even though it
  is a wall. A side with no Sappers on the board has none available.
- If a side has **no Flag on the board** (it was just captured — the game is
  already over by §6.1, which is checked first), do not throw: report that side's
  Flag as not enclosed and move on.

Performance is a non-issue (144 squares); recompute from scratch on every call —
do not build a cache.

Depends on: nothing new — `board.ts`, `pieces.ts`, `BoardState` from
`gameState.ts`.

Verification (automated): Add `src/rules/primary/v1_1/reachability.test.ts` and
run `npm test`. On hand-built `BoardState` fixtures (build them directly as
plain records — a full 48-piece army is not required), assert: a Flag in a board
corner walled in by its own Towers is **enclosed**; the same Flag with one wall
Tower removed (leaving an orthogonal path out toward the opponent's home rows)
is **not** enclosed; a Flag standing in the open is **not** enclosed; a Sapper
sealed in a pocket behind its own side's Towers with no path to any enemy Tower
is **unavailable**, while the same Sapper is **available** once one of those
Towers is removed; a side with **zero** Sappers has none available; an enemy
Tower is reachable **as a target** even though Towers are walls (a Sapper
orthogonally adjacent to an enemy Tower is available); **mobile pieces do not
block** (a wall of enemy Militia between a Sapper and an enemy Tower does not
make it unavailable); and **lakes do block** (a Sapper whose only path to an
enemy Tower runs through a lake is unavailable).

---

## Step 2 — The Flag becomes capturable (attack targeting & combat resolution)

Status: committed

Notes: `movement.ts`'s `isLegalAttackTarget` no longer rejects a Flag
defender (only a friendly piece is excluded now), so an enemy Flag is
offered wherever the existing adjacency/charge/rush geometry already
allows an attack; doc comments on `isLegalAttackTarget` and `legalAttacks`
updated to describe the new behavior. `combat.ts`'s `baseResult` gained a
Flag-defender case (`attackerWins`, no rank comparison) placed before the
Assassin/Tower/rank-table paths, and `resolveCombat` suppresses Archer
support whenever the defender is a Flag (`defender.pieceType !== "flag"`
guards the `archerSupportFires` call), so an Archer behind the Flag never
flips the capture to a mutual loss. Extended `movement.test.ts` (Flag
offered to a baseline piece and an Assassin adjacent; friendly Flag never
offered; Knight charge onto a Flag at distance 2/3, cut short by a blocker
and by a lake; Skirmisher rush onto a Flag at distance 1/2/3, cut short by
a blocker) and `combat.test.ts` (Militia/Assassin/charging-Knight/Sapper
all win outright against a Flag with `capture: true`/`archerSupport:
false`; three Archer-behind-the-Flag cases confirming support never fires
for a Militia's ordinary attack, a Knight's charge, and an attacking
Assassin). Deviation from the plan: fixing an obsolete pre-existing test in
`src/board/playSession.test.ts` ("a Flag square is never offered as an
attack target") was necessary because it asserted story 00000005's
excluded-Flag behavior, which this step deliberately changes; updated it
to assert the Flag is now offered and attackable (renamed accordingly).
This file/test isn't named in Step 2's own file list but the change is a
direct, unavoidable consequence of the `movement.ts` change and required
`npm test` to pass; no other files touched. No other deviations. `npm run
typecheck`, `npm run lint`, `npm test` (242 tests, 15 files), and `npm run
format:check` all pass (ran `prettier --write` on the new movement.test.ts
content to satisfy formatting).

Make the enemy Flag an attackable square in the **rule layer**, so it is offered
and resolved through story 00000005's existing attack pathway rather than a
third kind of ply.

- `src/rules/primary/v1_1/movement.ts` — in `legalAttacks`, stop excluding the
  Flag. Today its private `isLegalAttackTarget` rejects any target whose
  `pieceType` is `"flag"`; remove that exclusion so an **enemy** Flag is offered
  wherever the structural geometry already allows an attack: orthogonal
  adjacency for any mobile piece, a **Knight's charge** (2–3 squares over a clear
  line), and a **Skirmisher's rush** (up to 3 squares over a clear line). Every
  other rule stays exactly as it is — a **friendly** Flag is still never a
  target, the Flag is still immobile and still has no attacks of its own, and the
  Knight's anti-charge restriction still applies only to a **Halberdier** (a
  Knight *may* charge a Flag).
- `src/rules/primary/v1_1/combat.ts` — add the **Flag defender** case to
  `resolveCombat`: attacking a Flag is always **`attackerWins`**, whatever the
  attacker (including an Assassin, and including a Sapper), with **no rank
  comparison**. And the Flag is **never Archer-supported**: an Archer standing on
  the support trigger square behind a Flag must **not** flip the result to a
  mutual loss. (Place the Flag check so it precedes both the Assassin and the
  rank-table paths, and suppress the Archer-support override when the defender is
  a Flag.) The returned `CombatOutcome` keeps its existing shape: `capture` is
  `true` (the defender fell) and `archerSupport` is `false`.

Do not add game-end detection here — this step only makes the Flag a legal,
resolvable target. Between this step and Step 4, capturing a Flag simply removes
it from the board and play continues; that is a deliberate, transient
intermediate state, resolved by Step 4.

Depends on: nothing new (00000005's `movement.ts`/`combat.ts`).

Verification (automated): Extend `src/rules/primary/v1_1/movement.test.ts` and
`src/rules/primary/v1_1/combat.test.ts` and run `npm test`. Assert: an
orthogonally adjacent **enemy Flag is now offered** as an attack target (for a
baseline piece such as a Militia, and for an Assassin); a **Knight charges** an
enemy Flag at distance 2 and 3 over a clear line, and a **Skirmisher rushes**
one, while a blocker or a lake in the path still cuts the ray short; a
**friendly** Flag is still never offered; and, in `resolveCombat`: a Militia, an
Assassin, a Knight (adjacent and charging), and a Sapper attacking a Flag **all
win**, with `capture` true and `archerSupport` false — **including** when an
enemy Archer stands directly behind the Flag on the attacker's line of travel
(the Flag is never supported). Confirm the existing Archer-support cases for
non-Flag defenders are unchanged.

---

## Step 3 — The inactivity and progress counters in the play state

Status: committed

Notes: `PlayState` gained `inactivityCounters: Readonly<Record<Side, number>>`
and `progressCounter: number`; `startPlay` initializes both to
`{ white: 0, black: 0 }` / `0`. `applyMove` computes the mover/opponent
inactivity and the shared progress counter from the already-computed
`PlyOutcome` exactly per §6.4/§6.5: an attack always zeroes the mover's own
counter; a sacrificial attack (`attackerLoses` or `mutualLoss`) also zeroes
the opponent's; progress resets on `outcome.capture` (true for
`attackerWins`/`mutualLoss`) and otherwise increments by 1 for both a plain
move and a complete sacrifice. Everything else about `applyMove`
(immutability, side flip, move-string append, illegal-move throw, returned
shape) is unchanged. Extended `src/rules/primary/v1_1/play.test.ts` with a
new "applyMove counters (§6.4/§6.5)" describe block covering every case the
step's verification lists: fresh-game zero counters, a plain move raising
only the mover's inactivity and progress, a winning attack zeroing the
mover's inactivity and progress while leaving the opponent's inactivity
untouched, a complete sacrifice zeroing both inactivity counters while
raising progress by 1, a mutual loss zeroing both inactivity counters and
progress, a Sapper-destroys-Tower capture resetting progress, an alternating
plain-move sequence accumulating each side's counter independently while
progress counts every ply, and non-mutation of the input state's counters.
No deviations from the plan. `npm run typecheck`, `npm run lint`, and
`npm test` all pass (250 tests, 15 files); ran `npx prettier --write` on
`play.ts` to satisfy `npm run format:check` (the two pre-existing warnings
on `story.md`/`implementation-plan.md` are unrelated markdown-formatting
findings, not caused by this step, and left untouched).

Extend `src/rules/primary/v1_1/play.ts` so `PlayState` carries the two pieces of
§6.4/§6.5 rule state and `applyMove` evolves them from what the ply actually
did.

- `PlayState` gains a **per-side inactivity counter** (both sides, e.g. a record
  keyed by `Side`) and the **shared progress counter**. `startPlay` initializes
  all three to **0**.
- `applyMove` updates them from the `PlyOutcome` it already computes, per §6.4
  and §6.5, where "**attack**" means `outcome.kind === "attack"` and the three
  combat results are `attackerWins` / `attackerLoses` / `mutualLoss`:
  - **Mover's inactivity counter:** reset to **0** if the ply was an attack (any
    result); otherwise (a plain move) **+1**.
  - **Opponent's inactivity counter:** reset to **0** if the ply was an attack
    whose result was **sacrificial** — the mover's attacker did **not** survive,
    i.e. `attackerLoses` (complete sacrifice) **or** `mutualLoss` (partial
    sacrifice). Otherwise carried forward unchanged.
  - **Progress counter:** reset to **0** if the ply **captured** — the defender
    was removed, i.e. `attackerWins` **or** `mutualLoss` (this is exactly the
    existing `CombatOutcome.capture` flag, which is already `true` for both and
    `false` for `attackerLoses`). Otherwise **+1**. A plain move and a complete
    sacrifice both raise it.
- Keep everything else about `applyMove` unchanged: immutable, still flips
  `sideToMove`, still appends the plain `A2A3` move string, still throws on an
  illegal move, still returns `{ state, outcome }`.

Note the deliberate asymmetry between the two clocks and get it right: a
**complete sacrifice** resets *both* players' inactivity counters but does
**not** reset progress; a **mutual loss** resets both inactivity counters **and**
progress; a **winning attack** resets only the mover's inactivity counter and
resets progress.

Depends on: 00000005's `play.ts` (`applyMove`, `PlyOutcome`).

Verification (automated): Extend `src/rules/primary/v1_1/play.test.ts` and run
`npm test`. Assert, on hand-built fixtures: a fresh `startPlay` has all three
counters at 0; a plain move raises only the mover's inactivity counter and the
progress counter by 1 each, leaving the opponent's untouched; a **winning
attack** zeroes the mover's inactivity counter and the progress counter and
leaves the opponent's inactivity counter unchanged; a **complete sacrifice**
(attacker loses) zeroes **both** inactivity counters but **raises** progress by
1; a **mutual loss** zeroes both inactivity counters **and** progress; a
Sapper destroying a Tower is treated as a capture (progress reset); and that a
sequence of alternating plain moves accumulates each side's own counter
independently while progress counts every ply. The input state is never mutated.

---

## Step 4 — Game-end detection with the reference engine's precedence

Status: committed

Notes: Added `src/rules/primary/v1_1/outcome.ts` exporting `GameEndReason`,
`GameOutcome`, `INACTIVITY_LIMIT` (50), `PROGRESS_LIMIT` (80), and
`computeOutcome(board, activeSide, inactivityCounters, progressCounter)`
implementing the six-step precedence exactly as specified (flag capture via
a local `hasFlag` scan, §6.2 via Step 1's `computeUnbreachableFlagInputs`
computed once for both sides regardless of `activeSide` so a mutual win is
detected as a draw independent of whose turn it is, opponent inactivity,
shared progress, `hasAnyLegalPly`, then the active side's own inactivity for
completeness); it never imports `play.ts`. `movement.ts`'s
`hasAnyLegalNonAttackMove` was deleted and replaced with `hasAnyLegalPly`
(true if any of the side's pieces has a `legalDestinations` **or**
`legalAttacks` result), with `movement.test.ts` updated accordingly.
`play.ts`'s `PlayState` gained `result: GameOutcome`; `startPlay` computes it
at the reveal; `applyMove` now throws immediately if called on an
already-finished state and recomputes `result` after updating the counters
and flipping the side; added `agreeDraw(state)` producing `{ kind: "draw",
reason: "agreement" }` with everything else unchanged, throwing if the game
is already over. Added `src/rules/primary/v1_1/outcome.test.ts` covering
every case and precedence tie in the step's verification list. Extended
`play.test.ts` (`startPlay`/`applyMove` result detection, `agreeDraw`) and
`movement.test.ts` (`hasAnyLegalPly`, including the "only an attack
available" and "truly boxed-in" cases, the latter using immobile Tower
walls rather than mobile friendly pieces so the fixture doesn't
inadvertently give the boxed piece's neighbors legal moves of their own).
Deviation from the plan (necessary, not optional): once `startPlay`/
`applyMove` compute `result` eagerly, every pre-existing fixture across
`play.test.ts`, `src/board/playSession.test.ts`, and
`src/board/playAnnouncement.test.ts` that omitted a Flag for one or both
sides had its game immediately register as finished (no Flag on the board
reads as "already captured"), which made `applyMove` throw on the next ply
and broke 22 previously-passing tests. Fixed by adding a `["A1", "white",
"flag"]` / `["L12", "black", "flag"]` pair (far from the pieces each test
actually exercises) to every such fixture that applies more than one ply,
and by fixing two of my own new fixtures that had the same problem (a
fixture meant to test "leaves result ongoing" left Black with only an
immobile Flag, which is itself a no-legal-move loss; a Flag-capture fixture
had no White Flag at all, so the reveal was already decided). This mirrors
the precedent set in Step 2's notes for an unrelated pre-existing test.
`npm run typecheck`, `npm run lint`, `npm test` (276 tests, 16 files), and
`npm run format:check` (after `prettier --write` on the touched files) all
pass; the two pre-existing `story.md`/`implementation-plan.md` markdown
warnings are unrelated and untouched.

Add a new versioned module `src/rules/primary/v1_1/outcome.ts` (pure, no React)
that decides whether — and how — the game has ended, and wire it into
`PlayState`.

**`outcome.ts`** exposes:

- A **`GameOutcome`** value: either "ongoing", or a finished game carrying who
  won (or that it is a draw) and **why**. Recommended shape: a discriminated
  union over `{ kind: "ongoing" }`, `{ kind: "win"; winner: Side; reason }`, and
  `{ kind: "draw"; reason }`, with `reason` one of the six end reasons:
  **flag capture, unbreachable flag, no legal move, inactivity, no progress,
  agreement**. Keep the reasons as a small union of string literals — the record
  layer (Step 5) and the UI (Steps 9+) both map them to their own player-facing
  and PGN strings, so the rule layer's reason must be a stable identifier, not a
  sentence.
- A **`computeOutcome`** function taking **plain parameters** — the `BoardState`,
  the side to move, both inactivity counters, and the progress counter — **not** a
  `PlayState`, so this module never imports `play.ts` (which imports it). It
  implements the precedence in this plan's "Evaluation precedence" section
  **exactly, in that order**: (1) Flag capture, by checking whether each side
  still has a Flag on the board — active player's Flag gone → active player
  **loses**; opponent's Flag gone → active player **wins**; (2) Unbreachable Flag,
  from Step 1's four booleans — both sides' conditions met → **draw**, otherwise
  the side whose condition is met **wins**; (3) opponent's inactivity counter
  ≥ **50** → active player **wins**; (4) progress counter ≥ **80** → **draw**;
  (5) active player has **no legal ply** → active player **loses**; (6) active
  player's own inactivity counter ≥ 50 → active player **loses** (unreachable in
  normal play; implemented for completeness). Otherwise **ongoing**. Define the
  two limits (50, 80) as named constants in this module.
- The **50 / 80 limits are the rule constants**; the *warning thresholds* (10 own
  moves, 20 combined moves) are presentation and belong to Step 8 — do not put
  them here.

**`movement.ts`** gains the "no legal ply" primitive `computeOutcome` needs: a
`hasAnyLegalPly(board, side)` returning true if **any** of `side`'s pieces has at
least one `legalDestinations` **or** `legalAttacks` square. Delete the existing
`hasAnyLegalNonAttackMove` (a caller-less API whose own doc comment defers the
attack-aware version to this story) and update its cases in `movement.test.ts` to
the new function.

**`play.ts`** wires it in:

- `PlayState` gains a **`result: GameOutcome`** field.
- `startPlay` computes it **at the reveal** (before any ply): §6.2 can already
  hold from placement alone, so detection must run once at the start of Phase 2 —
  not only after plies.
- `applyMove` recomputes it after every ply (after the counters of Step 3 are
  updated and the side has flipped, so `computeOutcome` sees the new active
  player), and **throws** if called on a state whose `result` is already
  finished — like the existing illegal-move throw, this is a
  programming-invariant guard: the UI (Step 6) makes the board inert the moment
  the game ends, so it can never happen.
- Add **`agreeDraw(state)`**, returning a new state whose `result` is a draw by
  **agreement** — the one ending that is not detected but declared. It changes
  nothing else (no counters, no side flip, no move appended: an agreed draw
  leaves no trace in the move sequence). It throws if the game is already over.

Depends on: Step 1 (`reachability.ts`), Step 2 (a captured Flag is now possible),
Step 3 (the counters).

Verification (automated): Add `src/rules/primary/v1_1/outcome.test.ts`, extend
`play.test.ts` and `movement.test.ts`, and run `npm test`. Assert on hand-built
fixtures: an ordinary mid-game position is **ongoing**; the side to move having
**no Flag** is a **loss** for them and the opponent having none is a **win**;
a §6.2 position (own Flag enclosed, opponent's Sappers all unavailable) is a win
for that side **whichever side is to move**, and a position where **both** sides
qualify is a **draw**; the **opponent's** counter at 50 is a **win** for the
active player; progress at 80 is a **draw**; a side to move with **no legal ply
at all** (every piece boxed in by friendly pieces, lakes, and the edge — no
adjacent enemy, since an adjacent enemy would be a legal sacrificial attack)
**loses**; and every precedence tie: flag capture **beats** a simultaneous §6.2
condition, §6.2 **beats** an opponent inactivity loss, an opponent inactivity
loss at 50 **beats** a simultaneous progress counter at 80 (resolving as the
**loss**, not the draw), and both of those **beat** the active player's
no-legal-move loss. Also assert `startPlay` detects a §6.2 win **at the reveal**
(counters at 0, no plies played); `applyMove` sets `result` when a ply captures
a Flag; `applyMove` **throws** when the game is already over; `agreeDraw`
produces an agreed draw and leaves the board, counters, side to move, and move
list untouched; and `hasAnyLegalPly` is true for a piece with only an attack
available and false for a truly boxed-in side.

---

## Step 5 — `Result` and `ResultReason` in the game record

Status: committed

Notes: `renderGameRecord` in `src/rules/primary/v1_1/play.ts` now writes
`Result` and `ResultReason` header tags ahead of the existing `Ruleset` tag
and position block: `[Result "*"]` with no `ResultReason` tag while
`state.result.kind === "ongoing"`; otherwise `[Result "1-0"/"0-1"/"1/2-1/2"]`
(via a new private `renderResultValue(winner)` mapping White/Black to the PGN
values) followed by `[ResultReason "..."]` (via a new private
`renderResultReasonValue(reason)` switch mapping the six `GameEndReason`
identifiers to the technical-notes strings plus the owner-fixed
`"Agreement"`). Nothing else about the render changed: the position block
still renders `initialBoard`, and the move sequence is untouched. Extended
`play.test.ts` with a new "renderGameRecord - Result/ResultReason" describe
block covering every case in the step's verification list (ongoing, White
flag-capture win, Black win, no-progress draw via a `progressCounter`
override fixture matching the precedent set in Step 3's tests, an agreed
draw via `agreeDraw` asserting no move is added, and a check that `Ruleset`/
position block/move rounds remain present alongside the result tags). No
deviations from the plan. `npm run typecheck`, `npm run lint`, and `npm test`
all pass (282 tests, 16 files); ran `npx prettier --write` on the two
touched files to satisfy `npm run format:check` (the two pre-existing
`story.md`/`implementation-plan.md` markdown warnings are unrelated and
untouched).

Extend `renderGameRecord` in `src/rules/primary/v1_1/play.ts` to emit the record
file format's result header tags alongside the existing `Ruleset` tag, in PGN
`[Name "value"]` syntax, one per line, in the order **`Result`,
`ResultReason`, `Ruleset`** (the roster order the format defines):

- **`Result`** — always written. PGN values: `1-0` when **White** (Red) wins,
  `0-1` when **Black** (Blue) wins, `1/2-1/2` for a draw, `*` while the game is
  ongoing. Note the record uses White/Black, not the UI's Red/Blue.
- **`ResultReason`** — free text, written **only once the game has ended**; the
  tag is **omitted entirely while the game is ongoing** (owner's decision,
  2026-07-11), so an ongoing record carries `[Result "*"]` and no reason tag.
  The strings come from the companion repository's technical notes:
  **`Flag Captured`**, **`Unbreachable Flag`**, **`No Legal Move`**,
  **`Inactivity`**, **`No Progress`**, and — the one string the notes do not
  supply, fixed by the owner — **`Agreement`** for a draw by agreement.

Map from Step 4's `GameOutcome` (its reason identifiers and winner side). Keep
everything else about the render unchanged: the position block still renders
`initialBoard` (the *starting* position, never the current one), and the move
sequence still uses the plain **`A2A3`** form in numbered rounds, with **no**
combat markers and **no** entry of any kind for a draw offer, decline, or
agreement.

Depends on: Step 4 (`GameOutcome` on `PlayState`).

Verification (automated): Extend `src/rules/primary/v1_1/play.test.ts` and run
`npm test`. Assert the rendered record of an ongoing game contains
`[Result "*"]` and **no** `ResultReason` tag at all; a White (Red) flag-capture
win renders `[Result "1-0"]` and `[ResultReason "Flag Captured"]`; a Black (Blue)
win renders `[Result "0-1"]`; a no-progress draw renders `[Result "1/2-1/2"]`
and `[ResultReason "No Progress"]`; an agreed draw (via `agreeDraw`) renders
`[Result "1/2-1/2"]` and `[ResultReason "Agreement"]` **and adds no move to
the move sequence**; and that the `Ruleset` tag, position block, and plain-form
move rounds are all still present and unchanged.

---

## Step 6 — Session layer: inert board when the game ends, and the draw-offer state machine

Status: committed

Notes: `PlaySession` gained `drawOffer: Side | null` (`null` from
`startSession`); a private `isInert(session)` helper (`play.result.kind !==
"ongoing" || drawOffer !== null`) now gates `actionableSquares`,
`activatableSquares` (both return `[]` when inert), and `activateSquare`
(returns the session unchanged when inert). Added `offerDraw`, `acceptDraw`
(delegates to `play.ts`'s `agreeDraw`), and `declineDraw`, each with the
no-op guards the plan specifies; `offerDraw` also clears any current
selection. Extended `src/board/playSession.test.ts` with two new describe
blocks covering every case in the step's verification list (game-over
inertness across an own/enemy/empty square, and the full offer/accept/decline
state machine including all three no-op paths and the ordinary-session
regression check). Deviation from the plan (necessary, not optional): once
`actionableSquares`/`activatableSquares`/`activateSquare` also go inert
whenever `play.result.kind !== "ongoing"`, every pre-existing fixture in
`src/board/playSession.test.ts` and `src/board/playAnnouncement.test.ts` that
omitted a Flag for one or both sides now has its game register as already
finished at `startSession` (no Flag reads as "already captured" per Step 4's
`outcome.ts`), which silently turned `activateSquare` into a no-op and broke
19 previously-passing tests. Fixed by adding a `["A1", "white", "flag"]` /
`["L12", "black", "flag"]` pair (or an equivalent, out-of-the-way square) to
every affected fixture, mirroring the precedent Step 4's own notes set for
the same class of fallout. One fixture ("yields an empty actionable set...")
turned out, once given both sides' Flags, to be a genuine §6.3 no-legal-move
game-over case rather than merely a "stuck for one side" case — its comment
was updated to say so; the assertion (empty, never throws) still holds and
is arguably a better test of the intersection of Steps 4 and 6. No other
deviations. `npm run typecheck`, `npm run lint`, and `npm test` all pass (295
tests, 16 files); ran `npx prettier --write` on the touched test file to
satisfy `npm run format:check` (the two pre-existing `story.md`/
`implementation-plan.md` markdown warnings are unrelated and untouched).

Extend `src/board/playSession.ts` (pure, no React) so the interaction state
machine knows the game can be over and that a draw offer can be pending. No new
state model — this extends `PlaySession`.

- **`PlaySession` gains a pending draw offer**: the side that has offered a draw
  and is awaiting the opponent's answer, or `null` (e.g. `drawOffer: Side |
  null`, `null` from `startSession`). The offer does **not** change
  `play.sideToMove` — §6.6: an offer never replaces or skips a move.
- **Inertness.** When the game is over (`session.play.result.kind !== "ongoing"`)
  **or** a draw offer is pending, `actionableSquares` and `activatableSquares`
  both return **empty**, and `activateSquare` is a **no-op** (returns the session
  unchanged). This is how the board becomes inert without threading a "disabled"
  flag through `PlayBoard` — no cell is actionable, so nothing can be selected or
  moved. Any existing `selection` is cleared when an offer is made.
- **`offerDraw(session)`** — records the **side to move** as the offering side.
  A no-op if the game is over or an offer is already pending.
- **`acceptDraw(session)`** — ends the game as an agreed draw, via `play.ts`'s
  `agreeDraw` (Step 4), and clears the pending offer. A no-op if no offer is
  pending.
- **`declineDraw(session)`** — clears the pending offer and returns play to the
  offering player, who still has their turn (`sideToMove` never changed). Quiet:
  no counter change, no record entry, no penalty. A no-op if no offer is pending.
- Expose whatever small accessors the UI needs to render this without reaching
  into internals (e.g. whether the game is over, and who has offered) — or let
  the UI read `session.play.result` and `session.drawOffer` directly, if that
  reads more clearly. Either is acceptable; do not add a second source of truth.

Depends on: Step 4 (`GameOutcome` on `PlayState`, `agreeDraw`), and 00000005's
`playSession.ts`.

Verification (automated): Extend `src/board/playSession.test.ts` and run
`npm test`. Assert: with the game **over** (build a session whose play state has
a finished result — e.g. by applying a Flag-capturing ply), `actionableSquares`
and `activatableSquares` are **empty** and `activateSquare` on any square (an own
piece, an enemy piece, an empty square) returns the **same** session; `offerDraw`
records the side to move as the offerer, clears any selection, and makes the
board inert while pending; `declineDraw` clears the offer, leaves `sideToMove`
**unchanged** (the offerer still moves), adds **no** move to the record, changes
**no** counter, and restores the actionable/activatable sets so the offerer can
then move as usual; `acceptDraw` ends the game as an **agreed draw** and leaves
the board inert; `offerDraw` while the game is over, and `acceptDraw`/
`declineDraw` with no offer pending, are all no-ops; and an ordinary
mid-game session with no offer behaves exactly as before.

---

## Step 7 — Announcement wording: game end, and the draw-offer flow

Status: committed

Notes: `describeAttack` and the plain-move branch of `describeActivation` in
`src/board/playAnnouncement.ts` now take a `trailingClause` computed once per
activation - `"{Color} to move."` while `after.play.result.kind ===
"ongoing"`, otherwise the new exported `describeResult(result: GameOutcome)`
sentence (e.g. "Red wins — Flag captured.", "The game is a draw — No
progress.") - so a game-ending ply keeps its existing what-happened wording
and swaps only the trailing clause. Added a private `reasonPhrase` mapping
the six `GameEndReason` identifiers to capitalized player-facing phrases, and
three more exported functions for the draw-offer flow: `describeDrawOffer`
("Red offers a draw. Blue, accept or decline?"), `describeDrawDecline`
("Blue declines the draw offer. Red to move."), and `describeDrawAccepted`
(reuses `describeResult` for the agreed-draw outcome). Extended
`src/board/playAnnouncement.test.ts` with new describe blocks covering every
case in the step's verification list: a real Flag-capturing ply (naming
combatants, the Flag falling, the winner, and the reason, asserting no "to
move" text); three more game-ending plies for unbreachableFlag/inactivity/
noProgress built directly as hand-crafted `PlayState`/`PlaySession` pairs
(per the plan's own suggestion, since `describeActivation` only reads
`before`/`after` data and does not itself validate legality or re-derive the
result); `describeResult` for a win by each side across every reason, a draw
across the remaining reasons, and the ongoing/empty-string case; and the
offer/decline/accept sentences. Deviation from the plan (necessary, not
optional): two pre-existing combat-outcome tests in
`playAnnouncement.test.ts` ("attacker-wins" and "mutual-loss") left the
non-mover side with nothing but an immobile Flag once the ply's defeated
piece was removed, which is itself now a §6.3 no-legal-move win (per Step 4)
and changed their expected "Blue to move." trailing clause to a result
sentence; fixed by adding one extra, otherwise-uninvolved Black piece to each
fixture so Black still has a legal move afterward and the tests continue to
exercise the ordinary, non-ending case they were written for - mirroring the
precedent set in Steps 2/4/6's notes for the same class of fallout. No other
deviations; no UI (`App.tsx`) changes, as the step specifies. `npm run
typecheck`, `npm run lint`, and `npm test` all pass (306 tests, 16 files);
ran `npx prettier --write` on the two touched files to satisfy `npm run
format:check` (the two pre-existing `story.md`/`implementation-plan.md`
markdown warnings are unrelated and untouched).

Extend `src/board/playAnnouncement.ts` (pure, no React) so the board's single
polite live region also narrates the **end of the game** and the **draw-offer
flow**. This module remains the only place whose-turn (and now whose-victory)
information is pushed to assistive technology.

- **A game-ending ply.** `describeActivation(before, after, square)` currently
  ends every completed ply with "`{Red|Blue}` to move." When the ply ended the
  game (`after.play.result.kind !== "ongoing"`), that clause is **wrong** — nobody
  is to move. Replace it with the **result and reason** in player-facing terms:
  who won (**Red** / **Blue**) or that it is a **draw**, and why. Use the six
  reasons in plain player language — e.g. Flag captured, unbreachable Flag, no
  legal move, inactivity, no progress, agreement — with the rules' piece names and
  the word "move", never "ply". Keep the description of *what the ply did* (the
  existing plain-move and attack wording, including the combat outcome) and
  append the ending, so a player who did not see the board change hears both.
  A Flag capture is an attack in the existing wording and should read naturally
  (e.g. "Red Knight attacked Blue Flag at F12: Blue Flag falls, Red Knight
  advances. Red wins — Flag captured.").
- **An ending detected without a ply.** `startPlay` can already be finished (a
  §6.2 win at the reveal). Provide a small pure function that renders the
  **result-and-reason sentence** on its own from a `PlayState`/`GameOutcome`, so
  `App.tsx` (Step 9) can announce an ending that no activation produced, and so
  the end-of-game panel and this announcement can share one wording source.
- **The draw-offer flow.** Add pure functions that produce the announcement for
  each transition, for `App.tsx` to push into the same live region: the **offer**
  (naming the offering side and asking the opponent — e.g. "Red offers a draw.
  Blue, accept or decline?"), the **decline** (naming who declined and that the
  offering player still moves), and the **accept** (the game ends in an agreed
  draw — this can reuse the result-and-reason sentence).
- Exact phrasing is the implementer's judgment within these constraints:
  player-facing, Red/Blue, "move" not "ply", unambiguous when read across a
  hot-seat hand-off.

Depends on: Step 4 (`GameOutcome`), Step 6 (the session's draw-offer state). No
UI change here.

Verification (automated): Extend `src/board/playAnnouncement.test.ts` and run
`npm test`. Assert: a Flag-capturing ply's announcement names the combatants,
says the Flag fell, and **announces the winner and the reason** — and does
**not** say "to move"; a game-ending ply for each of the other detected reasons
(unbreachable Flag, inactivity, no progress; build the play states directly)
announces the right result and reason; an ordinary non-ending ply's wording is
**unchanged** from story 00000005 (still ends "…to move."), as are the selection
and deselection sentences; the standalone result sentence renders correctly for
a win by each side, for a draw, and for each reason; and the offer, decline, and
accept sentences name the sides correctly.

---

## Step 8 — Countdown warning thresholds & wording

Status: committed

Notes: Added `src/board/playWarnings.ts` exporting `computeCountdownWarnings(play:
PlayState)`, returning `{ inactivity, noProgress }` where each is either `null`
or a small structured record (`kind`, the relevant `side` for inactivity, the
computed `movesRemaining`, and a player-facing `message`) per the plan's
suggested shape. Both warnings are suppressed once `play.result.kind !==
"ongoing"`; the inactivity warning is computed only for `play.sideToMove`
against the story-fixed 10-remaining threshold (`INACTIVITY_LIMIT -
inactivityCounters[side] <= 10`); the no-progress warning is side-agnostic
against the story-fixed 20-remaining threshold (`PROGRESS_LIMIT -
progressCounter <= 20`), reusing `outcome.ts`'s `INACTIVITY_LIMIT`/
`PROGRESS_LIMIT` constants rather than redefining the rule limits. Two private
sentence-builders produce the player-facing wording (Red/Blue, "move" not
"ply"), the inactivity one always naming the color, the remaining count, and
that an attack resets it. Added `src/board/playWarnings.test.ts` covering
every case in the step's verification list: no warnings at the start of a
game, the 39/40-used boundary and the not-side-to-move case for inactivity,
the 40/45/49 remaining-count cases, the 59/60 boundary and turn-independence
for no-progress, the 60/70/79 remaining-count cases, both warnings together,
no warnings once the game is over (even with both counters deep in range, via
a directly-overridden finished `result` field on the fixture), and the
sentence wording (color, count, "attack" mention). No deviations from the
plan. `npm run typecheck`, `npm run lint`, and `npm test` all pass (325
tests, 17 files); ran `npx prettier --write` on the two new files to satisfy
`npm run format:check` (the two pre-existing `story.md`/
`implementation-plan.md` markdown warnings are unrelated and untouched).

Add a small pure module (e.g. `src/board/playWarnings.ts`, no React) that turns
the play state's counters into zero, one, or two **countdown warnings**. The
**thresholds are fixed by the story** and are not open to redesign here; this
module only decides how they are computed and phrased.

- **Inactivity warning** — shown to a player when **10 or fewer** of **their own**
  moves remain before their 50-move inactivity loss (i.e. `50 - theirCounter <=
  10`), and only **while it is their turn** (per in-scope item 4: "that player
  sees a warning while it is their turn"). It must state **how many moves remain**
  and that **an attack resets it**.
- **No-progress warning** — shown when **20 or fewer** moves (by **both players
  combined**) remain before the 80-move no-progress draw (i.e. `80 - progress <=
  20`). It applies to **both** players — it is shown on every turn once in range —
  and must state the **remaining count**.
- Report each warning as structured data (which warning, the remaining count) plus
  its **player-facing sentence** (Red/Blue, "move" not "ply", no jargon), so the
  banner component (Step 11) renders text it does not have to compose, and so the
  wording is unit-testable in the `node` test environment.
- No warnings once the game is **over**, and none while a count is out of range.
  The counts must **fall by one** as the relevant counter rises, and disappear the
  moment the counter is reset (an attack for inactivity; a capture for progress).

Depends on: Step 3 (the counters on `PlayState`), Step 4 (`result`, to suppress
warnings once the game is over).

Verification (automated): Add `src/board/playWarnings.test.ts` and run
`npm test`. Assert: no warnings at the start of a game; no inactivity warning at
39 own moves used (11 remaining) and a warning at 40 (10 remaining) **for the
side to move only** — the same counter for the side **not** to move produces no
warning; the remaining count is correct at 40, 45, and 49 (10, 5, and 1 moves
remaining); no no-progress warning at progress 59 (21 remaining) and a warning at
60 (20 remaining), shown regardless of whose turn it is, with the count correct
at 60, 70, and 79; both warnings appear together when both are in range; no
warnings at all when the game is over; and the sentences name the right color,
the right count, and (for inactivity) mention that an attack resets it.

---

## Step 9 — End-of-game presentation: result, reason, and an inert board

Status: committed

Notes: Added `src/board/GameResult.tsx` + `.css`: a visual-only panel (no
live region — the same rationale as the module's own comment: the result is
already announced once through the board's live region) rendering
`describeResult(result)` from `playAnnouncement.ts`, taking a `FinishedOutcome`
(`Exclude<GameOutcome, { kind: "ongoing" }>`) so its own type signature
enforces "only rendered once the game has ended"; `data-outcome`/`data-winner`
attributes drive a colored left-border accent (`--side-a`/`--side-b`/neutral
`--ink`) that is additional, not the only, signal — the sentence text always
carries the meaning. `src/App.tsx`'s Phase-2 branch now destructures
`playSession.play.result` and renders `GameResult` in `PlayStatus`'s slot
(same position, above `PlayBoard`) whenever `result.kind !== "ongoing"`;
`PlayBoard` and `GameRecord` keep rendering unconditionally so the final
position stays visible, and the board is already inert via Step 6's
`isInert`/`activatableSquares`. `handleConfirm` now also checks whether the
freshly started `playSession` is already finished (a §6.2 win at the reveal)
and, if so, pushes `describeResult(...)` into `playAnnouncement` directly,
since no activation occurs to drive `describeActivation` in that case. No
"New game" button was added — that is Step 10's responsibility per the plan
("Step 10 adds a 'New game' action inside this panel"). No deviations from
the plan. `npm run typecheck`, `npm run lint`, `npm test` (325 tests, 17
files), `npm run format:check` (only the two pre-existing unrelated
`story.md`/`implementation-plan.md` markdown warnings), and `npm run build`
all pass; `npm run dev` was started and confirmed to serve the app without
errors, but the manual gate itself (Gate A) is the owner's to run.

Wire the ending into the visible app. This is the first step where a player can
actually win.

- Add an end-of-game panel component (e.g. `src/board/GameResult.tsx` + `.css`)
  that renders, in player-facing terms, **who won** (Red or Blue) or that the game
  is a **draw**, and **why** (Flag captured, unbreachable Flag, no legal move,
  inactivity, no progress, agreement). It must **not obscure the board**: render
  it **above** the board, in the slot `PlayStatus` occupies (replace `PlayStatus`
  when the game is over — a finished game has no "to move"). No modal, no
  overlay. It is **visual only** — do **not** give it a live region: the result is
  already announced through the board's existing live region (Step 7), and a
  second announcement of the same sentence would double-speak.
- `src/App.tsx` — in the Phase-2 branch, render the panel instead of `PlayStatus`
  when `playSession.play.result.kind !== "ongoing"`. The board (`PlayBoard`) and
  the developer `GameRecord` dump keep rendering, so the **final position stays
  visible**. The board becomes inert automatically: Step 6 made
  `activatableSquares` empty for a finished game, so no cell responds to a click
  or Enter/Space, while cells stay focusable and readable.
- Also handle the **ending with no ply**: a §6.2 win can already hold when Phase 2
  starts. `App.tsx` starts the play session in `handleConfirm`; if the freshly
  started session is already finished, push the standalone result sentence (Step
  7) into the announcement state so it is announced, and the panel renders
  immediately.
- The word "move" (never "ply"), colors Red/Blue, rules' piece names.

Depends on: Steps 2, 4 (endings can now occur), Step 6 (inert board), Step 7
(announcement wording).

Verification (manual — **Gate A**): Run `npm run dev`, complete Phase-1 setup for
both sides (Auto-fill + Confirm each, adjusting placement by hand where the check
needs a specific adjacency), and enter Phase 2. Confirm:

- the enemy **Flag is offered as an attack-style target** when a piece can legally
  reach it — from an **adjacent** square, and **from distance** by a **charging
  Knight** (2–3 squares over a clear line) and a **rushing Skirmisher**;
- **capturing it ends the game at once**, with the **right winner** and the reason
  **Flag captured**;
- an **Archer stationed directly behind the Flag does not save it** (the capture is
  still a win, not a trade);
- the **final position stays visible** — the result panel does not cover the board
   — and the **board goes inert**: no piece can be selected, no move can be made,
  by mouse or keyboard.

---

## Step 10 — Start a new game

Status: committed

Notes: `GameResult` now takes an `onNewGame: () => void` prop and renders a
plain `<button type="button" className="game-result__new-game">New game</button>`
beside the result sentence, following `PlacementStatus.tsx`'s button precedent
(styled but with the UA focus outline left intact, so keyboard focus stays
visible; no live-region announcement — a screen-reader user tabbing to it hears
its name and role from the button itself). Because the panel only renders when
`result.kind !== "ongoing"`, the action is structurally unofferable while a game
is in progress — mid-game abandonment/resignation stays out of scope. `App.tsx`'s
`handleNewGame` performs the full reset: `setSession(newSession())`,
`setPlaySession(null)` (which is what routes `App` back to the placement branch),
`setSelection(null)`, `setPlayAnnouncement("")`. Nothing carries over. The panel
gained `gap`/`flex-wrap` to seat the button. No test file constructed
`GameResult`, so the new required prop broke nothing. Gate H verified manually by
the owner: a Flag-capture ending, then New game returns to a fresh empty Phase-1
placement (Red first, 0 / 48 placed, no pieces, no move record, no result panel),
the new game plays into Phase 2 normally, and New game is never offered mid-game.

Add the player-facing **New game** action, offered **only** from the end-of-game
presentation.

- Put a plain `<button type="button">` (following `PlacementStatus.tsx`'s
  precedent) in the end-of-game panel from Step 9, labeled for a non-technical
  player (e.g. "New game"). It must be keyboard-reachable and have an accessible
  name; note that the panel sits **above** the board in DOM order, so from a board
  cell it is reached with Shift+Tab — confirm at Gate H that it is reachable and
  focus is visible.
- `src/App.tsx` — the handler performs a **full reset**: a fresh
  `newSession()` placement session, `playSession` back to `null`, selection
  cleared, announcement cleared. Nothing carries over — both players place a fresh
  army from an empty board. Mid-game abandonment/resignation is **out of scope**:
  the action exists **only** while the game is over.

Depends on: Step 9 (the panel it lives in).

Verification (manual — **Gate H**): Run `npm run dev`, play a short game to any
ending (the quickest is a Flag capture — place a piece adjacent to the enemy Flag
during setup), and from the end-of-game presentation start a **new game**.
Confirm it returns to a **fresh, empty Phase-1 placement** for **both** players
(Red places first, tray full at 0 / 48 placed, board empty), with **nothing
carried over** from the finished game — no pieces, no move record, no result
panel — and that the new game can be played into Phase 2 normally. Confirm the
New game action is **not** offered at any point while a game is in progress.

---

## Step 11 — Countdown warnings in the UI (inactivity)

Status: committed

Notes: Added `src/board/PlayWarnings.tsx` + `.css`: a component rendering
Step 8's `CountdownWarnings` (zero, one, or both of `inactivity`/
`noProgress`) as visible `<p>` sentences inside a wrapper that is always
mounted with `role="status" aria-live="polite"` (kept mounted, not
conditionally rendered, so the live region is already registered with
assistive technology before the first warning appears, rather than being
created at the same moment as its first announcement) - deliberately its
own live region, separate from the board's existing one, per the plan. Each
warning sentence is prefixed with a bold, uppercased "Warning:" label so the
meaning is carried by text, not by the amber left-border accent alone
(`rgb(255 183 3)`, the same amber used for `PlayBoard.css`'s legal-move
fill, applied only as an additional cue). `src/App.tsx`'s Phase-2 branch now
renders `<PlayWarnings warnings={computeCountdownWarnings(playSession.play)}
/>` alongside `PlayStatus` in the `result.kind === "ongoing"` branch only
(warnings are moot once `GameResult` takes over the slot). No new rule-layer
or session-layer code — this step is UI-only, consuming Step 8's
already-tested `playWarnings.ts` module as-is. No deviations from the plan.
`npm run typecheck`, `npm run lint`, and `npm test` all pass (325 tests, 17
files — one run showed two unrelated `ENOMEM`/module-resolution errors from
the sandboxed Node process itself, not from the code under test; an
immediate re-run was clean); `npm run format:check` shows only the two
pre-existing unrelated `story.md`/`implementation-plan.md` markdown
warnings; `npm run build` succeeds.

Gate C: verified by the owner, but only on the second attempt. The first
attempt showed no warning at all, which turned out **not** to be a code
defect: the dev server had been started before this step's files existed and
its watcher never picked them up (unreliable under WSL2), so the browser was
executing an `App.tsx` with no `PlayWarnings` in it at all. Restarting Vite
with a cleared `node_modules/.vite` cache fixed it. **Lesson for later manual
gates: restart the dev server after an agent writes files, and confirm the
served module actually contains the new code (`curl -s
http://localhost:5173/src/App.tsx | grep ...`) before asking the owner to
verify.**

That false alarm exposed a real gap in coverage, so this step also adds
`src/board/playWarnings.game.test.ts` (13 tests): `playWarnings.test.ts` only
ever built counter fixtures by hand, so nothing proved a real stalling game
ever *reaches* those counter values. The new tests replay whole games through
`applyMove` and assert on the warnings at each ply. They also pin down a
rules consequence that is easy to mistake for a bug and that the plan's Gate C
wording did not anticipate: **a mutual shuffle can never produce the
inactivity loss.** Both sides making plain moves raises the shared progress
counter every ply, so the no-progress draw fires at 80 combined plies while
each side's own inactivity counter has only reached 40 - the no-progress
warning is the only one ever seen. Reaching the inactivity warning (counter
40) and loss (50) at all requires the *opponent* to keep capturing, since a
capture resets the shared progress counter and keeps the draw away; the
capture must be a clean win (`attackerWins`), as a sacrificial attack also
resets the stalling side's counter and undoes the stall. Both endings are now
covered end to end.

Render Step 8's warnings.

- Add a warnings banner component (e.g. `src/board/PlayWarnings.tsx` + `.css`)
  that renders the zero, one, or two warning sentences Step 8's module returns.
  Place it in the status area, next to / below `PlayStatus`, above the board — it
  must not cover the board.
- **Accessibility (in-scope item 4):** the banner is its **own** polite live region
  (`role="status" aria-live="polite"`), separate from the board's live region, so
  a screen-reader user hears the warning appear and hears the count change without
  bloating every move sentence. It must be **perceivable without relying on color
  alone**: the sentence itself carries the meaning (a word like "Warning" plus the
  count), and any color/icon treatment is an addition, never the only signal.
- `src/App.tsx` — render it in the Phase-2 branch while the game is ongoing.
- The counters themselves stay **quiet until a threshold is crossed** — do not add
  an always-on counter readout; the story is explicit that the UI stays quiet
  about the counters until one gets close.

Depends on: Step 8 (the warning module), Step 3 (the counters).

Verification (manual — **Gate C**): Run `npm run dev`, enter Phase 2, and have
**one** player shuffle non-attack moves (a piece stepping back and forth) while
the other plays normally. Confirm: **no warning** appears early in the game; once
the shuffling player has **10 of their own moves remaining** before the 50-move
inactivity loss, **that player sees the warning while it is their turn**, stating
how many of their moves remain and that **an attack resets it**; the count **falls
by one** with each further non-attack move they make; **an attack by them clears
the warning** (any attack — a sacrificial attack against an enemy piece or a
Tower is always available); and continuing to **50** **loses them the game on the
spot**, with the end-of-game presentation naming the **other player as the winner**
and the reason as **inactivity**.

---

## Step 12 — The no-progress draw, end to end

Status: committed

Notes: **Verification-only** - no production code changed, and no defect
surfaced. Gate D verified by the owner: the shared warning appears for both
players at 20 combined moves remaining and counts down, a capture clears it
(progress resets to 0), and reaching 80 combined moves ends the game as a draw
with the reason given as no progress and the board inert. The path was already
covered automatically as well: `play.test.ts` covers the complete-sacrifice
counter semantics (both inactivity counters zeroed, progress still raised by 1),
and Step 11's `playWarnings.game.test.ts` replays the whole mutual-shuffle game
through the engine - warning at 20 remaining, counting down, draw at
`PROGRESS_LIMIT`.

**Correction to this step's tester note below:** the occasional complete
sacrifice it prescribes (to hold the inactivity counters down while progress
climbs) is **not needed**. The no-progress draw fires at 80 *combined* plies, at
which point each side has made only 40 of *their own* plies - ten short of
`INACTIVITY_LIMIT`. A plain mutual shuffle therefore always reaches the draw
without any risk of an inactivity loss pre-empting it (pinned by the
"never raises an inactivity warning" test in `playWarnings.game.test.ts`). The
note is left in place below as originally written, but it describes a
precaution the rules do not require.

The no-progress counter (Step 3), its detection at 80 (Step 4), its warning at 20
remaining (Steps 8, 11), and the end-of-game presentation (Step 9) are all built
by this point. This step **exercises the no-progress path end-to-end and applies
any polish** needed to pass the gate — for example, correcting the wording or
placement of the shared warning, or a counter-reset bug the unit tests missed. If
manual testing surfaces a defect, fix it in the appropriate module and record it
in Notes; otherwise this step is **verification-only** (the 00000004/00000005
precedent, where several gate steps turned out to be verification-only).

Note for the tester: to hold the **inactivity** counters down while the
**progress** counter climbs, each player should make an occasional **complete
sacrifice** (send a non-Sapper piece against an enemy **Tower** — the attacker is
removed, the Tower stands, nothing is captured). A complete sacrifice resets both
players' inactivity counters but does **not** reset progress — that is exactly the
line the rule is designed to end in a draw.

Depends on: Steps 3, 4, 8, 9, 11.

Verification (manual — **Gate D**): Run `npm run dev`, enter Phase 2, and have
**both** players shuffle, using occasional complete sacrifices (against a Tower)
to hold their inactivity counters down without capturing anything. Confirm: the
**shared warning appears for both players at 20 moves remaining** (combined,
counting both players' moves), with the count falling as play continues; **any
capture clears it** (reset to 0 — make a winning attack or a mutual-loss trade and
confirm the warning disappears); and reaching **80** ends the game as a **draw**,
with the end-of-game presentation naming the reason as **no progress** and the
board going inert.

---

## Step 13 — Draw by agreement (offer, decline, accept)

Status: committed

Notes: Added `src/board/DrawOffer.tsx` + `.css`: a component with two
mutually exclusive faces driven by `PlaySession.drawOffer` - a plain
`<button type="button">Offer a draw</button>` (`PlacementStatus.tsx`'s
precedent) when no offer is pending, or a prompt panel (`GameResult.css`'s
panel chrome, with a `data-offering-side`-driven left accent border that is
additional, never the only signal) naming both sides explicitly ("Red
offers a draw. Blue, do you accept?") with Accept/Decline buttons while one
is. Renders no live region of its own, mirroring `GameResult.tsx`'s
rationale. `src/App.tsx`'s Phase-2 branch now imports `offerDraw`/
`acceptDraw`/`declineDraw` (`playSession.ts`) and `describeDrawOffer`/
`describeDrawDecline`/`describeDrawAccepted` (`playAnnouncement.ts`), adds
three handlers (`handleOfferDraw`, `handleAcceptDraw`, `handleDeclineDraw`)
that delegate the state transition to `playSession.ts` and push the
matching sentence into the same `playAnnouncement` live-region state the
ply narrative already uses, and renders `<DrawOffer>` alongside
`PlayStatus`/`PlayWarnings` in the `result.kind === "ongoing"` branch only
(the action is structurally unofferable once the game is over, since that
branch renders `GameResult` instead). The board's inertness while an offer
is pending and the orientation staying fixed were already handled by Step
6's session layer - no change needed there. No new automated tests: per the
project's testing conventions (`node` environment, no jsdom/DOM testing),
React components are not unit-tested - `DrawOffer.tsx`'s behavior is
exercised by the manual Gate E, and the state machine and wording it wires
together are already covered by Steps 6/7's existing `playSession.test.ts`/
`playAnnouncement.test.ts`. No deviations from the plan. `npm run
typecheck`, `npm run lint`, `npm test` (338 tests, 18 files - one run hit
the sandbox's known `ENOMEM` flake noted in Step 11's notes, unrelated to
this change; an immediate re-run was clean), `npm run format:check` (only
the two pre-existing unrelated `story.md`/`implementation-plan.md` markdown
warnings), and `npm run build` all pass.

**Owner decision at Gate E - board perspective during a pending offer
(reverses this step's bullet below, and `story.md` is updated to match).**
The step as written said the board's orientation must *not* change while an
offer is pending, on the grounds that `sideToMove` is unchanged and the
prompt names both sides. In hot-seat play that is wrong: the offer hands the
*physical* board to the opponent, who must answer Accept or Decline while
looking at the offerer's view of the board. The owner called this at Gate E
and chose the rule below; orientation and turn are now understood as separate
questions.

  Board perspective = **pending offer ? the responder : `sideToMove`.**

Implemented as `viewSide(session)` in `playSession.ts` (the session layer, not
the component, so it is testable in the `node` environment);
`PlayBoard.tsx` now orients to `viewSide(session)` instead of reading
`play.sideToMove` directly. On a **decline**, orientation reverts to the
offerer, who takes their turn as usual; on an **accept**, the game is over and
the final position is shown to the side to move - exactly as for every other
ending, so there is no special case for the agreed draw. Five tests in
`playSession.test.ts` cover it (follows `sideToMove` with no offer; switches to
the responder on an offer; switches back on decline; switches back on accept;
and symmetrically when Black is the offerer). Suite now 343 tests. The stale
comments in `playSession.ts`/`PlayBoard.tsx`/`DrawOffer.tsx` asserting that
orientation never flips during an offer were corrected.

Gate E: verified by the owner, including the perspective flip above.

Wire the draw-offer flow (Step 6's state machine, Step 7's wording) into the UI.

- Add an **Offer draw** action, available to the **active player on their turn**
  while the game is ongoing and no offer is pending. Put it in the status area
  beside `PlayStatus` (a plain `<button type="button">`, per
  `PlacementStatus.tsx`'s precedent) — it is a turn-level action, not a
  board-square gesture, and must not be added to the board grid's activation
  grammar.
- While an offer is **pending**, render a **prompt panel** in the status area
  presenting the offer to the opponent across the hot-seat hand-off, naming both
  sides explicitly (e.g. "Red offers a draw. Blue, do you accept?") with
  **Accept** and **Decline** buttons. The board is already inert while an offer is
  pending (Step 6) — the offer does not skip the move, so the board must not be
  playable until the offer is answered. The board's **orientation does not change**
  (`sideToMove` is unchanged): the prompt's explicit naming of both sides is what
  makes the hand-off unambiguous.
- **Accept** ends the game immediately in an **agreed draw** — the end-of-game
  panel (Step 9) takes over. **Decline** returns play to the **offering player**,
  who then **takes their turn as usual**; it is quiet — no penalty, and **no entry
  in the game record**.
- Push Step 7's offer / decline / accept sentences into the board's existing live
  region (the same `announcement` state `App.tsx` already threads into
  `PlayBoard`), so the flow is announced to a screen reader.
- Player-facing wording only: Red/Blue, "move" never "ply".

Depends on: Step 6 (offer/accept/decline session transitions), Step 7 (their
wording), Step 9 (the end-of-game panel an accepted draw lands in).

Verification (manual — **Gate E**): Run `npm run dev`, enter Phase 2, and confirm:
the **active player can offer a draw** on their turn (and only on their turn — the
action is not offered to the player who is not to move, nor once the game is
over); the opponent is **presented with the offer** and can **decline**, which
**hands play back to the offering player**, who **then moves as usual**; the
decline leaves **no trace in the developer game record** (open the record dump —
no extra move, no tag change); and **offering again and accepting** ends the game
**immediately** as an **agreed draw**, with the end-of-game presentation naming it
as a draw by agreement and the board going inert.

---

## Step 14 — The Unbreachable Flag, end to end

Status: committed

Notes: **Verification-only** for production code - no defect surfaced, nothing
in `src/` that the app bundles changed. Gate B verified by the owner, who
exercised more than the gate asked: an enclosed **Red** Flag with Blue's
Sappers locked away (instant Red win at the reveal), the mirror case with the
sides swapped (instant Blue win), **both** sides enclosed with both sides'
Sappers locked (instant **draw** - the §6.2 both-sides case from Step 4), and
the ordinary Sapper-available cases (win, draw, and correctly **no** result at
all when the Flag is not enclosed). Detection at the reveal, the mirror
symmetry, the draw case, and the negative case are therefore all confirmed in
the UI.

One real **coverage gap** was found and filled while preparing the gate. The
*reveal* half of §6.2 was already tested (`play.test.ts`: a walled Flag plus no
enemy Sapper, detected before any ply), but the *in-play* half - a ply capturing
the opponent's **last available Sapper** ending the game on the spot - was not
covered anywhere. `play.test.ts` gains
"ends the game the moment a ply captures the opponent's last available Sapper
(§6.2 in play)": White's Flag is sealed behind its own Towers while Black's
single Sapper stands in the open with a clear path to a White Tower (so it is
*available* and the game is ongoing at the reveal); White captures it, and
White wins immediately by unbreachable Flag - without the Flag itself ever
being threatened. Suite now 344 tests.

The reachability rule logic (Step 1), the §6.2 detection including the
both-sides-draw case and the check **at the reveal** (Step 4), and the
end-of-game presentation (Step 9) are all built by this point. This step
**exercises the §6.2 path end-to-end and applies any polish** needed to pass the
gate. If manual testing surfaces a defect — most likely in the reachability wall
set or the enclosure check — fix it in the appropriate module and record it in
Notes; otherwise this step is **verification-only**.

Note for the tester on staging the position: placement is unrestricted within a
player's own home zone (rows 1–4 for Red, rows 9–12 for Blue), each side has **8
Sappers, 6 Towers, and 1 Flag**, and the placement UI supports picking a piece
type from the tray and clicking home squares (plus Auto-fill for the rest).
Recall that **Towers and Flags of both sides are walls** and **mobile pieces are
ignored** for this check.

Depends on: Steps 1, 4, 9.

Verification (manual — **Gate B**): Run `npm run dev` and, using **placement**,
construct the condition:

- **At the reveal.** Have Blue seal **all 8 of their own Sappers** into a corner
  pocket (e.g. a 2×4 block) walled off by Blue's own 6 Towers so that no Blue
  Sapper has any path to a Red Tower, while Red **encloses their own Flag** in a
  corner behind Towers (with the board edge doing the rest of the work). Confirm
  the **Red win is detected at the reveal**, before any move is made, with the
  reason **unbreachable Flag**.
- **In play.** Set up a game where Red's Flag is enclosed and Blue is down to a
  **single available Sapper**; **capture that last Sapper** and confirm the game
  **ends immediately** with a Red win for the same reason.

---

## Step 15 — The result in the game record

Status: pending

The `Result` / `ResultReason` header tags (Step 5) surface automatically in the
existing developer `GameRecord` dump, which re-renders `renderGameRecord` on every
change. This step **verifies** them against real, played games and applies any
polish needed to pass the gate (a wrong tag value, a wrong reason string, a
missing tag). Fix any defect in `play.ts` and record it in Notes; otherwise
**verification-only**.

Depends on: Steps 5, 9, 13 (games that actually end, by capture, by counter, and
by agreement).

Verification (manual — **Gate G**): Run `npm run dev`, enter Phase 2, and open the
developer game-record dump (`Developer: inspect game record`). Confirm: **during
play** it carries **`[Result "*"]`** and **no `ResultReason` tag**; and after
games ending by **Flag capture**, by a **counter** (inactivity or no progress),
and by **agreement**, it carries the
**correct PGN result** (`1-0` for a Red/White win, `0-1` for a Blue/Black win,
`1/2-1/2` for a draw) and the **correct reason** (`Flag Captured`, `Inactivity` /
`No Progress`, `Agreement`) — alongside the unchanged `Ruleset` tag
(`PRIMARY:1.1`), the starting-position block, and the **plain-form** (`A2A3`) move
sequence, with **no** entry for the draw offer or decline.

---

## Step 16 — Accessible endings

Status: pending

Accessibility is built into Steps 9–13 (the Flag is an ordinary attack target in
the existing accessible grid; the warnings banner is its own polite live region;
the draw-offer control and prompt are plain buttons in the status area; the result
and reason are announced through the board's live region; the New game action is a
plain button). This step is the dedicated **accessibility gate** plus any small
polish needed to pass it — adjust labels, focus styling, DOM order, or
announcement strings as needed, and record any change in Notes.

One known rough edge to check and fix if it bites: the end-of-game panel (with the
New game button) sits **above** the board in DOM order, so after a game-ending
activation on a board cell, the button is reached with **Shift+Tab**. If that
proves confusing in testing, moving focus to the panel when the game ends (a
focusable heading, `tabIndex={-1}`) is an acceptable fix — but it must not trap
focus, and it must not cause the result to be announced twice.

Depends on: Steps 9, 10, 11, 13.

Verification (manual — **Gate F**): Run `npm run dev` and, **with the mouse put
away**, finish a full game **by keyboard alone** — including **capturing the
Flag**, **offering and answering a draw**, and **starting a new game**. With a
screen reader on (NVDA, VoiceOver, or Orca), confirm that the **Flag as an attack
target**, the **countdown warnings**, the **result and reason**, and the **New game
action** are all announced, and that **focus stays visible and untrapped** through
the end of the game (you can Tab away from the board and back, and reach every
control).

---

## Step 17 — README accuracy check

Status: pending

Review `README.md` against this story's changes and update it if warranted (the
`/update-readme` command automates this against the branch diff). After
00000005, the README tells players they can move, attack, and capture, but that
**winning, losing, and drawing** are still being built (see its "Move, attack,
and capture on the battlefield" bullet and its **Status** blockquote). With this
story, **Phase 2 is complete**: a game can be played end to end, from placement to
a recorded result — a player can capture the Flag and win, win by the unbreachable
Flag, lose to the inactivity clock, draw by no progress or by agreement, and start
a new game. Update the player-facing wording accordingly (Red/Blue, "move", no
jargon, no trademarked product names), and make clear what is still to come
(replaying recorded games, playing against the AI). If, on review, no change is
warranted, record that conclusion in Notes.

Depends on: all prior steps (the README describes the delivered behavior).

Verification (automated): Run `npm run typecheck`, `npm run lint`, `npm test`,
`npm run format:check`, and `npm run build` and confirm all pass; then re-read
`README.md` and confirm every statement it makes about what the app can do matches
the shipped behavior (or was updated to match).
