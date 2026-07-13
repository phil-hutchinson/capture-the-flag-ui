# Implementation Plan — Story 00000014: Import and review a recorded game

This plan puts a **start screen** in front of the app (play a game / review a
game), adds an **import** path that reads a recorded game file from the
player's device, and adds a **review screen** that replays that record on the
existing board with step/jump controls and a clickable move list. The hot-seat
game is unchanged apart from being reached from the start screen and being able
to leave it (with a confirmation while it is in progress).

Read `story.md` in this folder before implementing any step. It fixes the
policy — extended notation required, whole-file dry run at import, phantom
captures rejected, no rules ever applied, review is watch-only, red's
perspective always, import only (no export) — and the manual-verification gates
(A–E). This plan implements that policy; it does not re-decide it.

---

## Orienting facts for every step (cold-reader context)

### The codebase as it stands

- The app is front-end only (no backend, static hosting). Everything the
  reviewer does — reading the chosen file, parsing, replaying — happens in the
  browser. No new npm dependency is needed or wanted for this story.
- **Rules code is versioned**: everything under `src/rules/primary/v1_1/` is
  ruleset PRIMARY:1.1. `RULESET_TAG` (`gameState.ts`) is the string
  `"PRIMARY:1.1"`. Reading a record is version-sensitive, so the reader lives
  here, beside the writer it mirrors.
- **The writer this reader must agree with**: `renderGameRecord` in
  `src/rules/primary/v1_1/play.ts` (header tags + position block + rounds) and
  `renderPositionBlock` in `src/rules/primary/v1_1/gameState.ts` (the 12×12
  block). `renderGameRecord` currently emits the **plain** move form
  (`A2A3`); switching it to the extended form is explicitly **out of scope**
  (a later story). Do not change what `play.ts` emits.
- **Board model**: `BoardState` (`gameState.ts`) is a plain
  `Record<squareKey, PlacedPiece>`; `PlacedPiece` is `{ side, pieceType }`.
  `squareKey({column,row})` → `"A1"`. Sides are `"white"` / `"black"`
  internally, shown to players as **Red** / **Blue** via `sideColorName`
  (`src/board/sideNames.ts`). Player-facing text uses the colors and the word
  **"move"**, never "ply".
- **Board rendering**: `src/board/PlayBoard.tsx` draws the full 12×12 board
  through `src/board/grid/AccessibleGrid.tsx` (roving-tabindex grid, polite
  live region driven by an `announcement` prop) using `boardView.ts`
  (`fullBoardRows(side)` / `visibleColumns(side)`) and `PieceIcon`
  (`src/art/PieceIcon.tsx`). It currently takes a `PlaySession` — the review
  screen must **not** depend on `PlaySession`, so the presentational board is
  extracted in Step 7.
- **Player-facing result wording** lives in
  `src/board/playAnnouncement.ts` (`describeResult(GameOutcome)` → e.g.
  "Red wins — Flag captured.") and is shown by `src/board/GameResult.tsx`.
  `GameOutcome` / `GameEndReason` are defined in
  `src/rules/primary/v1_1/outcome.ts` (reasons: `flagCapture`,
  `unbreachableFlag`, `noLegalMove`, `inactivity`, `noProgress`, `agreement`).
- **Test environment**: `npm test` runs vitest with `environment: "node"`
  (`vite.config.ts`). There is **no jsdom, no testing-library, and no React
  component test in the repo**. Therefore: pure logic (parsing, replay,
  wording, the review cursor) is verified with **automated** unit tests, and
  everything that renders is verified **manually** with `npm run dev`. Do not
  add a DOM test stack for this story.
- Before every commit: `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `npm test` must all pass.

### The record file format (confirmed against the companion repository)

Confirmed on 2026-07-13 against
`doc/ruleset/technical-notes.md` (§ "Game notation and the record file
format"), `doc/ruleset/rules.md` §4.4, and the reference writer
`capture_the_flag/record.py` / `capture_the_flag/game_logging.py` in
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag).

A record file is three sections separated by **one or more blank lines**:

1. **Header tags** — PGN syntax `[Name "value"]`, one per line. The engine
   always writes `Ruleset`, `Result`, `ResultReason`; the PGN Seven-Tag-Roster
   tags (`Event`, `Site`, `Date`, `Round`, `White`, `Black`) are optional and
   best-effort. Tag values are PGN-escaped: a literal `\` is written `\\` and a
   literal `"` is written `\"`; newlines never appear inside a value.
   - `Ruleset` is `NAME:VERSION`, e.g. `PRIMARY:1.1`.
   - `Result` uses PGN values: `1-0` (White wins), `0-1` (Black wins),
     `1/2-1/2` (draw), `*` (ongoing/unknown).
   - `ResultReason` is free text; the engine's values are `Flag Captured`,
     `Unbreachable Flag`, `No Legal Move`, `Inactivity`, `No Progress` (and
     this app's writer additionally emits `Agreement`).
2. **Position block** — the record's **starting** board: 12 lines of 12
   three-character cells separated by single spaces, row 12 at the top, row 1
   at the bottom, column A at the left. Cells: White piece `[R]`, Black piece
   `*R*`, empty `---`, lake `XXX`, where `R` is the piece symbol
   (`1`–`9`, `A` Assassin, `T` Tower, `F` Flag — `PIECE_CATALOG[...].symbol` in
   `pieces.ts`). This is exactly what `renderPositionBlock` produces.
3. **Move sequence** — rounds numbered from 1, each `N. WhiteMove BlackMove`,
   one round per line **or wrapped freely** (the section is
   whitespace-insensitive). A game ending on White's move shows a final round
   with only White's move. White always moves first in a from-placement record.
   - A **mid-game** record (format-reserved, not produced by any engine today)
     would open with `N... <blackmove>`. This app rejects such a file.

**File conventions**: UTF-8; readers must accept both LF and CRLF line
endings; the engine writes a trailing newline.

**Move notation** (rules.md §4.4). Two forms exist:

- **Plain**: `A4A5` — source square immediately followed by destination, no
  separator. The record file format permits it; **this story rejects it**
  (owner's fixed policy: a record we cannot replay without applying the rules
  is not reviewable). This is a deliberate divergence from the companion
  format's "a reader must accept both", and the rejection message must say so
  in plain language.
- **Extended (result-marking)**: always a `-` between the two squares, with an
  `x` immediately after a square meaning "the piece that stood there did not
  survive this move". This is what the reference engine emits.
  - `A4-A5` — a move with no attack.
  - `A4-A5x` — attacker wins; the defender is removed and the attacker advances.
  - `A4x-A5` — attacker loses (complete sacrifice); the defender stands.
  - `A4x-A5x` — mutual loss; both are removed.

### Replay semantics (stated once — applied blindly, no rules)

For a move `S[x]-D[x]` by the side whose turn it is (White on the first move of
each round, Black on the second):

1. Remove the piece on `D` if `D` is marked `x`.
2. If `S` is marked `x`, remove the piece on `S` (it does not move). Otherwise
   move the piece from `S` to `D`.

Nothing else is consulted — no ranks, no reachability, no support, no legality,
no game-end detection. A Sapper taking a Tower and a piece taking the Flag are
ordinary `S-Dx` moves. The result shown at the end of a review is what the
file's `Result` / `ResultReason` tags claim, quoted back, never computed.

**Internal-consistency checks (the only checks; a failure rejects the file):**

- `S` must hold a piece, and that piece must belong to the side whose turn it
  is. (Rejects "moves from an empty square" and "moves the other side's
  piece".)
- **Combat marks and an occupied destination go together** (owner's decision,
  2026-07-13). Judged against the board *before* the move:
  - If `D` holds a piece, the move must carry **at least one** `x` — on `D`, on
    `S`, or both. A move onto an occupied square with no marks at all is a
    piece landing on top of a piece the record does not remove: rejected.
  - If `D` is empty, the move must carry **no** `x` at all. An `x` on `D`
    removes nothing (a phantom capture); an `x` on `S` sacrifices the attacker
    against nothing. Both are records we cannot make sense of: rejected.

  Equivalently: a move is marked if and only if its destination is occupied.
  This is an internal-consistency check, not a rules check — it never consults
  ranks, reachability or support.
- Terrain is **not** checked on moves (a record that moves a piece onto a lake
  square replays as recorded); the position block's lake cells *are* checked
  (see Step 2), because that is the format's own self-description.
- Army composition is **not** checked: the reader accepts any position block,
  including one that is not a full 48-piece-per-side placement.

### Resolutions of the story's "Open items to resolve at plan time"

1. **Record format / notation grammar** — confirmed as above against the
   companion repository. **Strictness decisions taken here**: unknown and
   roster header tags are accepted and ignored; a `Ruleset` tag is **required**
   and must be exactly `PRIMARY:1.1` (anything else → "unknown ruleset"
   rejection); `Result` / `ResultReason` are optional (absent ⇒ the review
   simply ends without claiming an outcome); a **duplicate** occurrence of a
   tag the app uses (`Ruleset`, `Result`, `ResultReason`) is a malformed record
   and is rejected. **Whitespace forgiveness**: accept LF and CRLF, leading and
   trailing blank lines, any number of blank lines between sections, trailing
   spaces on any line, extra spaces between position-block cells, and freely
   wrapped move-sequence lines. Round numbers must run 1, 2, 3… in order, with
   two moves per round except possibly the last; `N...` (mid-game) records are
   rejected with their own message.
2. **Which screen am I on** — a discriminated-union `Screen` value held in
   `useState` in `App.tsx` (`start` | `play` | `import` | `review` carrying the
   loaded game). No router library, no URL routing (out of scope). `App.tsx`
   becomes a thin shell: each screen is its own component, and the hot-seat
   game's own state lives *inside* its component, so unmounting it discards the
   game and remounting it starts a fresh one.
3. **Review screen layout** — reuses the hot-seat screen's shape: the app title,
   then a status/result bar in the same slot `PlayStatus` / `GameResult` occupy
   (where you are in the game, and — at the end — the recorded result), then the
   existing `app__layout` two-column row: the board in the board column with the
   review controls directly beneath it (where `PlacementControls` sit), and the
   move list in the right-hand column (where the `Tray` sits). The board is the
   shared presentational board from Step 7, always drawn from red's
   perspective; the flip-board toggle and the developer game-record dump are
   not shown in review.
4. **One module or several** — several, split by job, all under
   `src/rules/primary/v1_1/`: `notation.ts` (the move-notation grammar —
   the single home of the grammar, exporting both a parser *and* a renderer, so
   the future extended-form writer changes this module rather than forking it),
   `parsePositionBlock` added to `gameState.ts` (next to `renderPositionBlock`,
   its inverse), `recordFile.ts` (file text → sections, tags, starting board,
   move tokens), and `replay.ts` (starting board + moves → every position, with
   the consistency checks). A tiny version-dispatch entry point,
   `src/rules/readRecord.ts`, reads the `Ruleset` tag and delegates to the
   v1_1 reader (or rejects an unknown ruleset), so a future ruleset version
   adds a reader rather than editing this one.

### Where the player-facing wording lives

The rules layer returns **structured** errors and result data (no sentences) —
consistent with `outcome.ts` returning `GameEndReason` identifiers rather than
text. A UI-layer module (`src/review/reviewText.ts`, Step 6) turns those into
the player-facing sentences, using `sideColorName` and reusing
`describeResult` so a reviewed result reads word-for-word like a played one.

---

## Steps

### Step 1 — The move-notation grammar

Status: committed

Notes: Added `src/rules/primary/v1_1/notation.ts` (`RecordedMove`,
`ParsedMoveToken`, `parseMoveToken`, `renderMoveToken`) and
`notation.test.ts`. Parsing uses one shared square sub-pattern
(`[A-L](?:1[0-2]|[1-9])`) for both the extended and plain regexes so a
plain-form token is recognized (and rejected with the distinct
`"plainNotation"` kind) rather than merely falling through to `"malformed"`.
No deviation from the plan.

Add `src/rules/primary/v1_1/notation.ts`: the single home of the move-notation
grammar for this ruleset version. It parses one move token (e.g. `A4x-A5x`)
into a structured recorded move — the source square, the destination square,
and whether the piece on each did not survive — and renders such a move back to
its extended-form token. Both forms of the grammar (parse and render) live here
so the reader and the future extended-form writer cannot drift apart; nothing
in the app calls the renderer yet (Step 5's fixture script does).

Parsing must: accept the four extended shapes (`S-D`, `S-Dx`, `Sx-D`,
`Sx-Dx`) with squares in the absolute White frame (columns A–L, rows 1–12,
uppercase); reject a plain-form token (`A4A5`) with a **distinct** error kind,
since the app rejects plain-notation files with their own message; and reject
anything else as a malformed move token. Return a discriminated result (parsed
move or error kind) — do not throw, and do not produce player-facing text here.

Depends on: nothing (uses `board.ts`'s `Column`/`Row`/`Square` only).

Verification (automated): `npm test` — new unit tests in
`notation.test.ts` covering each of the four extended shapes (including a
two-digit row, e.g. `L12x-L11`), the plain-form rejection (`A4A5` → the
plain-notation error kind), malformed tokens (`A4-`, `M4-A5`, `A13-A5`,
`a4-a5`, `A4--A5`, `A4x-A5xx`, empty string), and a round-trip
(parse → render → identical token) over all four shapes.

---

### Step 2 — Reading the position block

Status: committed

Notes: Added `parsePositionBlock` to `gameState.ts` alongside a
`PIECE_TYPE_BY_SYMBOL` reverse lookup, `PositionBlockError` (six kinds:
`wrongRowCount`, `wrongCellCount`, `unrecognizedCell`, `unknownPieceSymbol`,
`lakeCellOffLake`, `lakeSquareNotXxx`) and `PositionBlockResult`. Blank lines
are tolerated wherever they fall (not just at the leading/trailing edges),
which is slightly more lenient than the plan's minimum ask but harmless since
a genuinely missing row is still caught by the row-count check. New tests in
`gameState.test.ts` cover the round-trip (including a sparse board with
pieces removed and a non-full-army board, proving army composition/counts are
never checked), whitespace/CRLF tolerance, and each rejection case. No other
deviation from the plan.

Add a position-block **parser** to `src/rules/primary/v1_1/gameState.ts`,
directly alongside `renderPositionBlock` (its inverse): given the 12 lines of
the block, produce a `BoardState`, or a structured error if the block is not a
valid 12×12 board.

It must accept exactly what `renderPositionBlock` writes, plus reasonable
whitespace slop (leading/trailing spaces, more than one space between cells,
CRLF line endings). It must reject: a block that is not 12 rows of 12 cells; an
unrecognized cell; a piece symbol not in `PIECE_CATALOG`; and a lake cell
(`XXX`) that is not exactly on one of the 12 lake squares (`isLake` in
`board.ts`), or a lake square whose cell is not `XXX` — that is the format's own
self-description, not a rules check. It must **not** check army composition or
counts. Return a structured error; no player-facing text.

Depends on: Step 1 only in the sense that both are rule-layer primitives; it
can be implemented independently.

Verification (automated): `npm test` — new tests in `gameState.test.ts`:
a **round-trip** over generated boards (build boards with
`placement.ts`'s `autoFill` for both sides via `buildInitialGameState`, render
with `renderPositionBlock`, parse back, and assert the `BoardState` is
identical — repeat for several boards, including a board with pieces removed to
prove empty cells round-trip); the whitespace/CRLF tolerances; and each
rejection case above.

---

### Step 3 — The record-file parser

Status: committed

Notes: Added `src/rules/primary/v1_1/recordFile.ts` (`parseRecordFile`,
`RecordFileTags`, `RecordedPly`, `ParsedRecord`, `RecordFileError`,
`RecordFileResult`) and `src/rules/readRecord.ts` (`readRecord`,
`ReadRecordError`, `ReadRecordResult`), plus `recordFile.test.ts` and
`readRecord.test.ts`. Two judgment calls not spelled out verbatim in the
step, recorded here since they shape the error surface: (1) `notARecord`
covers both "fewer than two blank-line-separated chunks" and "the header
chunk's lines don't all match the `[Name "value"]` tag pattern" — a header
that parses cleanly but simply lacks a `Ruleset` tag is instead
`missingRuleset` (distinct because a record author who forgot the tag is a
different problem from a non-record file); (2) `readRecord.ts`'s ruleset
dispatch is a light-touch regex scan for a `[Ruleset "..."]` line anywhere in
the raw text (not a full header parse) so that an unrelated ruleset's
position-block/notation syntax is never run through the v1_1 parser before
the ruleset is known to match — if no such line is found anywhere, that's
`notARecord` at the dispatch level too. No other deviation from the plan.
`RecordFileError` has two round-shaped error kinds beyond what the step
names outright: `malformedRound` (a stray token where a round marker was
expected) and `emptyRound` (a round marker with no moves following it at
all) alongside `tooManyMovesInRound` (three or more) — kept distinct rather
than folded together so a message can say precisely what's wrong.

Add `src/rules/primary/v1_1/recordFile.ts`: file text → a parsed record (the
header tags, the starting `BoardState`, and the ordered list of moves with, for
each, its token, its round number and the side that made it), or a structured
error. Also add the version-dispatch entry point `src/rules/readRecord.ts`,
which scans the header for the `Ruleset` tag and delegates to the v1_1 reader
when it is `PRIMARY:1.1`, returning an unknown-ruleset error otherwise (and a
"not a game record" error when there is no readable header at all). This is the
only entry point the UI will call.

Behavior, per "The record file format" above:

- Split the file into three sections on one-or-more blank lines; tolerate LF or
  CRLF, leading/trailing blank lines, and trailing spaces.
- Header tags: `[Name "value"]` per line, with PGN escaping (`\\`, `\"`)
  decoded. Unknown and roster tags are accepted and ignored. `Ruleset` is
  required. `Result` and `ResultReason` are optional and are carried through as
  raw strings for the UI to interpret (Step 6) — the parser does not judge
  them. A duplicate `Ruleset` / `Result` / `ResultReason` tag is a malformed
  record.
- Position block: delegated to Step 2's parser.
- Move sequence: whitespace-insensitive; tokenize, then read `N.` round
  markers. Round numbers must ascend from 1 with exactly two moves per round
  except possibly the last. Each move token is parsed with Step 1's grammar:
  **any** plain-form token rejects the whole file with the plain-notation error
  (the owner's fixed policy — no mixing). A `N...` mid-game marker is rejected
  with its own error kind. A record with no moves at all is valid (a game
  recorded before any move) — the review then shows only the opening position.
- Every error carries what a message will need: for a move error, the move's
  1-based ply number, its round number, the side, and the token.

Depends on: Step 1 (move grammar), Step 2 (position block).

Verification (automated): `npm test` — new tests in `recordFile.test.ts`
covering: a full valid record (built in the test from `renderPositionBlock` plus
a handful of extended moves) parsed into the expected tags, board and move list;
CRLF input; extra blank lines between sections; roster and unknown tags ignored;
a freely wrapped move sequence; missing/duplicate `Ruleset`; unknown ruleset
(via `readRecord.ts`); a plain-notation file; a mixed plain/extended file; a
`N...` mid-game file; out-of-order or skipped round numbers; a three-move round;
a file of arbitrary non-record text (e.g. binary-ish garbage) rejected as "not a
game record"; and a zero-move record accepted.

---

### Step 4 — The replayer (the import dry run)

Status: committed

Notes: Added `src/rules/primary/v1_1/replay.ts` (`replayRecord`, `ReplayedRecord`,
`ReplayedPly`, `ReplayError`, `ReplayResult`) and `replay.test.ts`, and wired it
into `src/rules/readRecord.ts` so `readRecord` is parse-then-replay: its
`ParsedRecord`/success shape changed to `ReplayedRecord` (`positions` +
`moves`, no bare `startingBoard`), and `ReadRecordError` gained a `"replay"`
case carrying `ReplayError`. Updated `readRecord.test.ts` accordingly
(`startingBoard` -> `positions[0]`) and added a case proving a structurally
valid record with an unplayable move (empty-square source) is rejected end to
end through `readRecord`, not part-loaded. One judgment call beyond what the
step names outright: the "empty destination marked with an x" rejection is
split into two distinct error kinds - `phantomCapture` (`toRemoved` on an
empty destination - a capture of nothing) and `phantomSacrifice`
(`fromRemoved` on an empty destination with no `toRemoved` - the attacker
sacrificed against nothing) - rather than one combined kind, following
`recordFile.ts`'s precedent of distinct kinds for distinct problems so
`reviewText.ts` (Step 6) can word each precisely; when both marks are present
on an empty destination, `phantomCapture` is reported (an untested
double-phantom edge case the plan does not call out). No other deviation
from the plan.

Add `src/rules/primary/v1_1/replay.ts`: given a parsed record (Step 3), replay
every move from the starting board and return the **whole** game — the ordered
list of positions (the opening board plus one `BoardState` after each move, so
`moves.length + 1` positions in all), each move annotated with its round number,
side and token — or a structured error naming the move that could not be
carried out. Wire it into `src/rules/readRecord.ts` so that reading a record is
parse-then-replay: the entry point returns either a fully replayed recorded game
or a rejection. This is the story's "rejected at import, not part-loaded" rule:
there is no partial result.

Apply exactly the replay semantics and the internal-consistency checks stated in
the orienting facts above — no rules, no legality, no combat resolution, no
game-end detection. Errors carry the ply number, round number, side, token and
the offending square.

Depends on: Step 3 (parsed record), Step 1 (move shape).

Verification (automated): `npm test` — new tests in `replay.test.ts`:
each of the four move shapes changes the board exactly as specified (quiet move;
attacker wins and advances; complete sacrifice leaves the defender standing;
mutual loss empties both squares); a Sapper-onto-Tower and a piece-onto-Flag
replay as ordinary `S-Dx` moves with no special casing; positions are
`moves+1` long and the opening position is untouched by later moves; the board
after the last move matches an independently constructed expectation; **and an
illegal-by-the-rules but internally consistent record replays without
complaint** (e.g. a piece "moving" from A1 to L12 in one move) — the reviewer is
not a referee. Rejections: move from an empty square; a side moving the other
side's piece; a piece landing on an occupied, unmarked destination; and — the
empty-destination cases — `S-Dx` where `D` is empty (an `x` that removes
nothing) and `Sx-D` where `D` is empty (an attacker sacrificed against
nothing). Each is reported with the right ply number and token.

---

### Step 5 — Sample record files for the manual gates

Status: committed

Notes: Added five files under `doc/plan/00000014-game-reviewer/samples/`
(`good-game.txt`, `plain-notation.txt`, `unknown-ruleset.txt`,
`empty-square-move.txt`, `phantom-capture.txt`) and a corpus test,
`src/rules/readRecord.samples.test.ts`, that reads them via `readRecord` and
checks the good one replays to its Flag capture (100 moves, 101 positions,
no Flag of the losing color left on the board, `Result`/`ResultReason` tags
present) and each bad one is rejected with the matching error kind. The good
game was generated exactly as the plan specifies: a throwaway vitest test
(`__gen_sample.script.test.ts`, run once via `npx vitest run` then deleted,
never committed) built two full 48-piece armies with `placement.ts`'s
`autoFill`, ran them through `play.ts`'s `startPlay`/`applyMove`, and chose
among the legal plies `movement.ts` offered (biased 85% toward an available
attack over a plain move, since a purely uniform walk across two full armies
rarely makes contact) using a seeded LCG (the same generator
`placement.test.ts`/`gameState.test.ts` already use for reproducibility). It
tried seeds in turn, rejecting a game that ran past 300 plies or that didn't
end in a Flag capture containing at least one plain capture, one complete
sacrifice, one mutual loss, and a Sapper destroying a Tower; seed 907 was the
first to satisfy all of that, in 100 plies (50 rounds) — Black wins by Flag
capture. Every move's `x` marks were derived from the real `PlyOutcome`
`applyMove` returned, via `renderMoveToken`; nothing was hand-computed. Event
move numbers in that game: complete sacrifice at ply 3, plain capture at ply
46, mutual loss at ply 51, Sapper-vs-Tower at ply 98, Flag capture (game end)
at ply 100. The bad samples are hand-derived from the good one's own token
list (an empty-square source substituted into ply 1 — row 5 is the buffer,
guaranteed empty at the game's start — a phantom `x` added to the first
quiet move, an altered `Ruleset` tag value, and every token flattened to the
plain form) rather than literal post-hoc text edits, which is equivalent but
kept the script free of fragile string surgery. Also added `@types/node` as
a new dev-dependency (pinned to `^22.20.1`, matching the container's Node
22) so the corpus test can use Node's `fs`/`url` modules per the step's own
instruction to read the sample files that way; `tsconfig.app.json` picks up
its ambient types automatically (no config change needed).

Produce the record files the story's manual gates (B and C) need, and commit
them under `doc/plan/00000014-game-reviewer/samples/` (plain `.txt` files):

- **A good game** in extended notation, containing captures, complete
  sacrifices, mutual losses, a Sapper destroying a Tower, and a Flag capture,
  with `Result` / `ResultReason` tags. Generate it with a throwaway script
  (improvised verification — delete the script afterwards, or keep it out of
  `src/`): use the existing engine (`placement.ts`'s `autoFill`,
  `play.ts`'s `startPlay`/`applyMove`, `movement.ts`'s legal moves/attacks) to
  play a random legal game to a Flag capture, and render the record with
  `renderPositionBlock` plus Step 1's extended-move renderer (derive each move's
  `x` marks from the `PlyOutcome` `applyMove` returns: attacker-wins ⇒ `x` on
  the destination; attacker-loses ⇒ `x` on the source; mutual loss ⇒ both). Do
  **not** change what `play.ts` emits — the extended-form writer is a later
  story.
- **Bad files** for Gate C, hand-derived from the good one: the same game in
  plain notation; a record whose ruleset tag is an unknown version; a record
  with a move from an empty square; a record with an `x` that removes nothing.
  (Gate C's "a file that is not a game record at all" needs no fixture — the
  owner picks any photo.)

Add a corpus test that reads the committed sample files and asserts the good one
is accepted (with the expected move count and a final position that has no Flag
of the losing color left on the board) and each bad one is rejected with the
expected error kind. Read the files in the test with Node's `fs` from an
absolute path derived from the test file's own URL (the vitest environment is
`node`).

Note for the owner: these samples are produced by *this* codebase's engine, so
Gate B should ideally also be run against a record produced by the companion
repository's own engine, if one can be supplied.

Depends on: Step 4 (a working reader to test the samples against), Step 1
(extended-move renderer).

Verification (automated): `npm test` — the corpus test above passes; the
committed good sample is a complete, well-formed record file (header tags,
position block, rounds) whose replay ends in a Flag capture.

---

### Step 6 — Player-facing wording for rejections and the recorded result

Status: committed

Notes: Added `src/review/reviewText.ts` (`describeRejection`,
`describeRecordedResult`) and `reviewText.test.ts`. `describeRejection`
covers every kind of `ReadRecordError`, `RecordFileError`, `PositionBlockError`
and `ReplayError` through nested switches, each ending in
`default: return kind satisfies never;` (the same exhaustiveness pattern
`playAnnouncement.ts`'s `reasonLabel` already uses) so a future error kind
fails to compile until this module is taught its wording, per the step's
instruction. `describeRecordedResult` maps the four `Result` values and the
engine's `ResultReason` strings (plus `Agreement`) case-insensitively onto
`GameEndReason`, reusing `describeResult` for a recognized reason and
quoting an unrecognized one verbatim; one judgment call beyond what the plan
names outright: a `Result` value that is present but not one of the four
recognized strings (and isn't `*`) is treated the same as absent/`*` — no
claim at all — since the record-file parser never validates `Result`'s
value and silently making no claim is safer than guessing. No other
deviation from the plan.

Add `src/review/reviewText.ts`: the one place the reviewer's player-facing
sentences are built. It is pure (no React) and has two jobs:

1. **Rejection messages.** Turn each structured reader error (Steps 2–4) into a
   sentence a player can act on, per the story: what is wrong and — where it is
   a specific move — which move, naming the move by its number, its round, its
   side by **color**, and its token. Examples of the register wanted: "This file
   uses the short move notation, which doesn't record what happened to each
   piece, so it can't be reviewed."; "Move 12 (round 6, blue) — F5-F6 starts
   from an empty square."; "This game was recorded under ruleset PRIMARY:2.0,
   which this app doesn't know how to review."; "This file isn't a game record."
   Use "move", never "ply"; use Red/Blue via `sideColorName`, never
   White/Black.
2. **The recorded result.** Turn the file's `Result` / `ResultReason` tags into
   the sentence shown at the end of a review, made explicit as the record's
   claim rather than a computed outcome (e.g. prefixed "The record says: "). Map
   `1-0` → red wins, `0-1` → blue wins, `1/2-1/2` → draw, `*` (or absent) → no
   claim at all. Map a recognized `ResultReason` (the engine's five strings plus
   `Agreement`, matched case-insensitively) onto the matching `GameEndReason` and
   reuse `describeResult` (`src/board/playAnnouncement.ts`) so a reviewed result
   reads word-for-word like a played one; quote an **unrecognized** reason
   verbatim instead of dropping it, and handle a `Result` with no reason at all.

Depends on: Steps 3 and 4 (the error and result shapes it renders).

Verification (automated): `npm test` — new tests in `reviewText.test.ts`
asserting: one message per error kind, each naming the move (number, round,
color, token) where the error is move-specific; no message contains the word
"ply", "White" or "Black"; the four `Result` values map to the expected
sentence; a recognized reason produces exactly `describeResult`'s wording inside
the record-claim framing; an unrecognized reason is quoted; absent `Result` or
`*` yields no result sentence.

---

### Step 7 — Extract the presentational board (shared by play and review)

Status: committed

Notes: Added `src/board/FullBoard.tsx` + `src/board/FullBoard.css` (a `git mv`
of `PlayBoard.css`, with every `.play-board*` selector renamed to
`.full-board*` and a new `--last-move` rule appended — a forest-green
fill/ring, a color used nowhere else on the board, so it can never be
mistaken for `--selected`, `--attack`, `--destination`, or the amber focus
ring). `PlayBoard.tsx` is now a thin adapter: it computes `viewSide` and
passes `session.play.board`, `selected`, `destinationSquares`,
`attackSquares` and `activatableSquares` straight through to `FullBoard`,
reproducing the pre-refactor highlighting logic exactly (same precedence:
attack over destination, both empty with nothing selected), with no change
to `App.tsx`'s usage or props. `lastMove` is a new optional `{ from, to }`
prop on `FullBoard`, plumbed into both the cell's class list and its
accessible label (", last move" suffix); `PlayBoard` never passes it, so
hot-seat rendering is unchanged. Updated a stale cross-file comment in
`PlayWarnings.css` that named `PlayBoard.css` by file name. Checked
`AccessibleGrid.tsx`/`gridNavigation.ts`: cell focusability is already
driven solely by `GridCellDescriptor.focusable` (always `true` here),
independent of `actionable`, and the click handler is simply omitted for a
non-actionable cell rather than attached-and-guarded — so an
all-non-actionable grid (an inert review board) is already fully
keyboard-navigable and silent on activation with no warnings; no change was
needed there, so none was made. `npm run typecheck`, `npm run lint`,
`npm run format:check` and `npm test` (445 tests) all pass; `npm run build`
also verified clean. No behavioral deviation from the plan; the only naming
choice beyond it was renaming the CSS classes from `play-board*` to
`full-board*` (rather than leaving the old class names in place under the
new file), on the reasoning that the review screen rendering a literal
`play-board__square--attack` class would be a confusing fossil, and the
rename is a mechanical, purely-cosmetic string substitution with identical
computed styles.

Refactor `src/board/PlayBoard.tsx` so the board rendering no longer depends on
`PlaySession`: extract a presentational full-board component (e.g.
`src/board/FullBoard.tsx` + its CSS, taking over `PlayBoard.css`) that takes a
`BoardState`, the side whose perspective to draw from, the sets of squares to
highlight (selected / plain-move destination / attack target, plus a **new**
last-move-from / last-move-to highlight), the set of squares that respond to
activation, an optional `onActivate`, and the live-region `announcement`
string. `PlayBoard` becomes a thin adapter that derives those props from a
`PlaySession` (`viewSide`, `actionableSquares`, `attackTargets`,
`activatableSquares`) and renders the shared component; the hot-seat game's
behavior and appearance must not change.

The new last-move highlight is what makes "the last move made is evident on the
board" possible in review (Step 11); give it a visual treatment distinct from
the existing selection/destination/attack fills and from the amber focus ring
(see `PlayBoard.tsx`'s module comment for the rules that treatment must respect),
and include it in the affected squares' accessible labels. It is unused by the
hot-seat game.

An inert board (no activatable squares, no `onActivate`) must still be fully
navigable by keyboard and readable by a screen reader — the grid's cells stay
focusable, they simply do nothing when activated. Check
`AccessibleGrid.tsx` handles an all-non-actionable grid without warning, and fix
it there if not.

Depends on: nothing new (pure refactor of existing components); it precedes the
review screen, which consumes it.

Verification (manual): `npm run dev` — play a hot-seat game through placement
into a few moves and an attack: the board looks and behaves exactly as before
(selection, destination and attack highlighting, keyboard navigation, the
live-region announcements). Nothing in the story's behavior is visible yet.
Also confirm `npm run typecheck && npm run lint && npm test` stay clean.

---

### Step 8 — The start screen and the app shell

Status: committed

Notes: `App.tsx` is now a thin shell holding a `Screen` discriminated union
(`start` | `play` | `import` | `review` carrying a `ReplayedRecord`) in
`useState`, with no router. Moved today's entire placement-and-play UI
verbatim into `src/board/HotSeatGame.tsx` (same state, same logic, only the
imports' relative paths and the component name changed); mounting it (via
"Play a game") starts a fresh placement and unmounting it (reachable from
Step 15 onward) will discard the game in progress. Added
`src/app/StartScreen.tsx` (+ CSS): the app name, tagline, and two buttons
("Play a game" / "Two players, one device" and "Review a game" / "Watch a
recorded game") styled after `PlacementStatus.css`'s button chrome. Added the
Step-9 stub `src/review/ImportScreen.tsx` (+ CSS): only a heading and a
"Back" button, wired to return to `start`. Every screen's top-level heading
is a `tabIndex={-1} <h1>` focused via `useEffect` on mount (the same pattern
`GameResult.tsx` already uses for its "New game" button), so a keyboard/
screen-reader user is never stranded when the screen changes; `HotSeatGame`'s
heading-focus effect fires once on mount only, deliberately not re-firing
across the internal placement-to-play transition (not a screen change).
`App.tsx`'s `review` case is currently unreachable (nothing yet produces a
`Screen` in that state — `ImportScreen` has no file picker until Step 9) and
renders `null`; this is intentional per the step's own phasing ("Step 9
fills in the file picker") and is called out here as it's the one branch of
the new shell with no observable behavior yet. No other deviation from the
plan; `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`
(445 tests) and `npm run build` all pass.

Turn `App.tsx` into a shell that holds a `Screen` state — `start` | `play` |
`import` | `review` (the review case carrying the loaded recorded game) — as a
discriminated union in `useState`. No router library and no URL routing.

- Move today's entire placement-and-play UI, verbatim, out of `App.tsx` into its
  own component (e.g. `src/board/HotSeatGame.tsx`), keeping all of its state
  inside it. Mounting it starts a fresh game; unmounting it discards one. The
  "Flip board between turns" setting stays where it is (a device setting read
  from local storage), and stays out of the review screen.
- Add `src/app/StartScreen.tsx` (+ CSS): the app name and two clearly labeled
  choices a player understands without explanation — **Play a game** ("Two
  players, one device") and **Review a game** ("Watch a recorded game") — as
  plain buttons, keyboard-reachable with visible focus, following the existing
  button precedent in `PlacementStatus.tsx` / `GameResult.tsx`.
- "Play a game" mounts the hot-seat game (placement exactly as before). "Review
  a game" navigates to the import screen: in this step that screen is a stub
  containing only its heading and a **Back** button that returns to the start
  screen (Step 9 fills in the file picker). Separating the shell from the import
  behavior keeps each verifiable on its own.
- On every screen change, move focus to the new screen's heading (a
  `tabIndex={-1}` heading focused on mount) so keyboard and screen-reader users
  are not stranded.

Depends on: nothing from Steps 1–7 (it is UI scaffolding); it must land before
the import and review screens have anywhere to live.

Verification (manual): `npm run dev` — **Gate A, part 1**: the app opens on the
start screen; "Play a game" reaches placement and the hot-seat game plays
exactly as before, end to end; "Review a game" shows the (stub) import screen and
"Back" returns to the start screen; both start-screen choices are reachable and
activatable by keyboard alone with a visible focus ring.

---

### Step 9 — Import a file: choose, read, reject or load

Status: pending

Fill in `src/review/ImportScreen.tsx` (the stub from Step 8): a file input the
player uses to choose a file from their device (no `accept` filter narrow enough
to prevent choosing a photo — Gate C requires that a wrong file *can* be chosen
and rejected), a short line of explanation ("Nothing is uploaded — the file is
read on your device."), and a **Back** button to the start screen. Read the file
in the browser (`File.text()`), pass the text to `src/rules/readRecord.ts`, and:

- On rejection: show the player-facing message from `reviewText.ts` (Step 6) in
  an assertive live region (`role="alert"`) so it is **announced**, not just
  shown, keep the screen usable, and let the player choose a different file
  straight away. Nothing crashes and nothing blanks out, whatever file is
  chosen — including a large binary file (guard against pathological sizes with
  a simple size ceiling and its own message if you add one).
- On success: navigate to the review screen with the fully replayed game. In
  this step the review screen (`src/review/ReviewScreen.tsx`) shows only the
  **opening position** — the shared inert board from Step 7, always from red's
  perspective, no controls yet — plus a heading and a **Back to start** button.
  No confirmation on leaving a review (nothing is lost).

Depends on: Step 4 / `readRecord.ts` (the reader), Step 6 (the messages), Step 7
(the inert board), Step 8 (the shell and the stub screen), Step 5 (the sample
files to try).

Verification (manual): `npm run dev` with the Step 5 samples — **Gate A, part 2
and Gate C**: choosing the good sample lands on the review screen showing the
recorded opening position (both armies, red at the bottom); "Back to start"
returns without a prompt, and choosing a file again starts a fresh import. Each
bad sample — plain notation, unknown ruleset, move from an empty square, `x`
that removes nothing — and any random photo produce a clear, actionable message
on the import screen naming the problem (and, where it is a move, which move),
after which a different file can be chosen successfully. The message is
announced by a screen reader (or, at minimum, confirm the `role="alert"` region
is populated).

---

### Step 10 — The review session (cursor over the replayed game)

Status: pending

Add `src/review/reviewSession.ts`: the reviewer's own state — the recorded game
(from Step 4) plus a cursor into its positions — and the pure operations over
it: step forward, step back, jump to the opening, jump to the final position,
and jump to the position after a given move. Plus the derived readings the UI
needs: the board to draw at the cursor, the move just made (its token, round,
side and its from/to squares, for the last-move highlight), whether the cursor is
at the start or the end, and a short player-facing description of where you are
("Opening position" / "Move 23 of 57 — round 12, red").

It must be deliberately independent of `PlaySession` / `PlayState` (no rule
state, no side-to-move logic beyond what the record says), and immutable in the
same style as the rest of the codebase (operations return a new session). Out of
range cursor operations clamp rather than throw. Player-facing strings belong in
`reviewText.ts` (Step 6) if they are more than trivial — keep the wording in one
place.

Depends on: Step 4 (the recorded game shape).

Verification (automated): `npm test` — new tests in `reviewSession.test.ts`
over a small hand-built recorded game: forward/back walk the positions in order
and are exact inverses; back at the opening and forward at the end are no-ops;
jump-to-start and jump-to-end reach the first and last positions; jump-to-move
lands on the position *after* that move; the board at cursor *n* equals the
replayed position *n*; the last-move readout names the right move and squares at
each cursor (and is absent at the opening).

---

### Step 11 — Review controls: step, jump, and where you are

Status: pending

Add the review controls to the review screen (`src/review/ReviewControls.tsx` +
CSS, placed directly beneath the board where `PlacementControls` sit in the
hot-seat layout): **Jump to start**, **Back**, **Forward**, **Jump to end** —
plain buttons, disabled at the ends of the game, keyboard-reachable with visible
focus, wired to Step 10's session. Show where you are in the game (round and
side) in the status slot above the board — the same slot `PlayStatus` occupies in
the hot-seat game. Highlight the last move made on the board using Step 7's
last-move from/to highlight. The board stays inert: no square is activatable,
nothing is selectable or movable.

Depends on: Step 10 (the session), Step 9 (the review screen), Step 7 (the board
and its last-move highlight).

Verification (manual): `npm run dev` with the good sample — **Gate B, part 1**:
stepping forward moves and removes exactly the pieces the record says (check a
capture, a complete sacrifice, a mutual loss, the Sapper-vs-Tower and the final
Flag capture against the sample file's move list); stepping back undoes them
exactly; jump-to-end reaches the final position; jump-to-start returns to the
opening; the buttons disable at the ends; the last move is visibly marked; the
status line names the right round and side; clicking a board square does nothing.

---

### Step 12 — The move list

Status: pending

Add `src/review/MoveList.tsx` (+ CSS) in the review screen's right-hand column
(where the `Tray` sits in the hot-seat layout): the game's rounds as recorded —
round number, red's move, blue's move — where each move is a button that jumps
the board to the position **after** that move. The move currently shown is
marked (visually and for assistive technology, e.g. `aria-current`), and the
list scrolls to keep it in view as the player steps through with the controls.
Every move is reachable by keyboard.

Show the moves in the record's own notation (they are already player-facing
square names); do not invent a different notation.

Depends on: Step 11 (the controls and the session wired into the screen).

Verification (manual): `npm run dev` with the good sample — **Gate B, part 2**:
clicking moves in the list lands on exactly the right positions (spot-check
several, including the last); stepping with the controls moves the highlight in
the list and keeps it in view; the list is navigable and clickable by keyboard
alone.

---

### Step 13 — The recorded result

Status: pending

At the end of the game (cursor at the final position), show what the record says
about how it ended — who won, in **red/blue**, or that it was a draw, and the
reason — in the status slot above the board, in the same wording the hot-seat
game uses, and framed as the record's claim rather than something the app worked
out (Step 6's `reviewText.ts`). If the record carries no result (absent or `*`),
the review simply ends at the last position with no outcome claimed. Do not
compute or check anything.

Depends on: Step 6 (the wording), Step 11 (the screen and cursor).

Verification (manual): `npm run dev` — **Gate B, part 3**: jumping to the end of
the good sample shows the result the file's tags claim, worded like the hot-seat
game's result and clearly attributed to the record; stepping back from the end
removes the claim; hand-edit a copy of the sample to carry `[Result "1/2-1/2"]`
with `[ResultReason "No Progress"]`, and again with a nonsense reason, and again
with the result tags deleted, and confirm each behaves as specified.

---

### Step 14 — Review accessibility

Status: pending

Complete the story's accessibility scope for the review path, extending the
established patterns rather than inventing new ones (the roving-tabindex grid in
`AccessibleGrid.tsx`, its polite live region, and the assertive alert added in
Step 9):

- Stepping or jumping announces the position reached, through the board's polite
  live region — the move that was made (color, piece, from/to, and what the
  record says was removed) and where you now are in the game; reaching the end
  announces the recorded result. Build the wording in `reviewText.ts` (Step 6),
  reusing `sideColorName` and `PIECE_CATALOG` display names, and — as in the
  hot-seat game — announce it from exactly one live region so nothing is said
  twice.
- The whole review path is operable by keyboard alone, with visible focus
  throughout and no focus trap: start screen → import → review → controls →
  move list → back to start.
- The inert board's cells are still focusable and their labels still describe
  what occupies each square.

Depends on: Steps 9, 11, 12, 13 (everything being announced must exist).

Verification (manual): `npm run dev` — **Gate E**: with the mouse put away, a
game can be imported and reviewed end to end by keyboard alone; with a screen
reader on, the start screen's choices, a rejection message, each move stepped
through, and the recorded result are all announced; focus stays visible and
untrapped throughout.

---

### Step 15 — Leaving a game

Status: pending

Add the way out of the hot-seat game: a **Back to start** control on the
hot-seat screen (visible during placement, during play, and after the game ends
— place it consistently, e.g. in the status area above the board). Leaving a
game **in progress** (placing or playing) first asks the player to confirm, in a
modal dialog that says the game will be lost; confirming returns to the start
screen, cancelling leaves the game exactly as it was (same placement, same
position, same selection). Leaving a **finished** game — and leaving a review —
exits with no prompt. Starting a new game from the start screen begins from an
empty placement; starting a new review begins from a fresh import.

Implement the dialog with the platform's native modal dialog element (focus
containment, Escape-to-cancel and assistive-technology semantics come for free);
give it an accessible name and description, move focus into it on open and back
to the control that opened it on cancel. Do not add a dependency for this.

Depends on: Step 8 (the shell owns the screen state and the hot-seat game's
mount/unmount), Step 9 (leaving a review).

Verification (manual): `npm run dev` — **Gate D**: leaving mid-placement and
mid-play both warn that the game will be lost; cancelling leaves the game
untouched and playable (including any in-progress selection); confirming returns
to the start screen, and starting a new hot-seat game begins from an empty
placement with nothing carried over. Leaving a finished game and leaving a
review exit without a prompt. The dialog is keyboard-operable (Escape cancels,
Tab stays inside it) and focus returns sensibly when it closes.

---

### Step 16 — README check and final sweep

Status: pending

Review `README.md` against what this story changed and update it for a
non-technical player: the app now opens on a start screen with two choices, and
"Replay finished games from their game log files" is no longer "coming soon" —
it is here, for records produced by the companion project's engine, with the
honest caveat that a game played *in this app* cannot yet be saved or reviewed
(that is a later story). Keep the existing tone and structure; do not add
technical detail (that belongs in `CONTRIBUTING.md`). Running the
`/update-readme` command is the intended route. Also confirm nothing else in the
README (setup, rules links, status blurb) has gone stale.

Then run the full check suite one last time over the whole story.

Depends on: every previous step (the README describes the finished behavior).

Verification (manual): read the updated `README.md` end to end and confirm it
describes the app a player now has — the two choices on the start screen, what
reviewing a game does and where records come from, and no claim the app cannot
keep. Confirm `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm test` and `npm run build` all pass clean.
