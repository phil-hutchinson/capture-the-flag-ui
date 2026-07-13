# Story 00000014 — Import and review a recorded game

## Summary

Add a second thing you can do with this app: watch a recorded game.

Today the app opens straight into a hot-seat game — placement, then play,
then a result. This story puts a **start screen** in front of that, offering a
choice: **play a game** (the hot-seat game we already have, unchanged) or
**review a game**. Choosing "review a game" asks you for a game file. If the
file is one we can read, you land on a **review screen**: the same board you
already know, showing the game from its opening position, with controls to
walk through it — forward, back, jump to the start or the end, or click any
move in the list to jump straight to that position.

The reviewer is a viewer, not a referee. It does not know or check the rules:
it takes the recorded moves at face value, sliding pieces from square to
square and removing the pieces the record says were removed. A recorded game
that breaks the rules will replay exactly as it was recorded, illegal moves
and all. That is deliberate — a review screen that argued with the record
would be useless for looking at games from the companion project's engine and
its AI training, which is what this is for.

From either mode you can get back to the start screen. Leaving a hot-seat game
in progress asks you to confirm first, since the game is lost when you go;
leaving a review does not, since nothing is lost.

## Background & references

- The rules live in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository; `doc/ruleset/rules.md` is the single source of truth and is not
  restated here. This story is written against ruleset **PRIMARY:1.1**.
- The **record file format** and the **move notation** are specified in that
  repository (`doc/ruleset/technical-notes.md` and rules.md §4.4). In outline:
  a file is three blank-line-separated sections — PGN-style header tags
  (including `Result`, `ResultReason` and `Ruleset`), a position block drawing
  the full 12×12 starting board from White's perspective, and a move sequence
  numbered in rounds (`N. WhiteMove BlackMove`).
- **Notation.** The plain form (`A4A5`) records only where a piece went. The
  **extended result-marking form** (`A4-A5`, `A4-A5x`, `A4x-A5`, `A4x-A5x`)
  also records what died: an `x` immediately after a square means the piece
  that was on that square did not survive the move. That is what makes a
  record replayable without applying the rules, and it is what the reference
  engine emits as standard. Confirm the exact grammar against the companion
  repository at plan time.
- This app already writes a record: `renderGameRecord` in
  `src/rules/primary/v1_1/play.ts` builds the header tags, the position block
  (`renderPositionBlock` in `gameState.ts`) and the move sequence, and
  `src/board/GameRecord.tsx` shows it in the developer dump. This story
  **reads** that same format. The writer is the natural reference for the
  reader, and the two must agree.
- **Ruleset versioning:** reading a record is version-sensitive (the position
  block's piece letters and the notation belong to a ruleset), so the reader
  belongs with the other per-version code, alongside the writer it mirrors.

## Policy (fixed by the owner, 2026-07-13)

- **Extended notation is required, throughout.** Every move in the file must
  carry the result-marking form. A file containing *any* plain-form move
  (`A2A3`) is rejected, with a message saying so in plain language. We do not
  guess at combat outcomes, not even for a quiet move to an empty square.
- **A file we cannot replay is rejected at import,** not part-loaded. The
  whole game is replayed through as a dry run when the file is chosen; if any
  move cannot be carried out on the board it produces, the file is rejected
  and the player is told which move was the problem. The review screen only
  ever shows a game it can play from beginning to end.
- **Phantom captures are rejected too.** An `x` that removes nothing, or a
  move that lands a piece on top of a piece that the record does not remove,
  is a record we cannot make sense of — the file is rejected on the same
  terms. (Rules legality is *never* checked; internal consistency is.)
- **No rules are applied, ever.** No legality, no combat resolution, no
  game-end detection. The outcome shown at the end of the review is the one
  the file's `Result` / `ResultReason` tags claim, quoted back, not one we
  compute.
- **Reviewing is watching.** Forward, back, jump to start, jump to end, and a
  clickable move list. No "take over from here," no editing, no autoplay.
- **Getting out.** Both modes offer a way back to the start screen. Leaving a
  hot-seat game **in progress** (placing, or playing) asks for confirmation
  first; leaving a finished hot-seat game or a review does not.
- **Import only, this story.** The hot-seat game keeps writing the plain form
  and still has no way to save a file, so a game played *in this app* is not
  yet reviewable in it. That gap is accepted and closed by later stories
  (switch the emitted record to the extended form; save a game to a file).
  Records for this story come from the companion repository's engine.

## Players and colors

Unchanged: first player = White = Side A = red (`#a13d2b`); second player =
Black = Side B = blue (`#33526b`). Player-facing surfaces name the sides by
color (red / blue) and use the word "move" (never "ply").

## In scope

1. **A start screen.** The app now opens on a start screen naming the game and
   offering two choices: **play a game** (hot-seat, two players at one device)
   and **review a game** (import a recorded game and watch it). Each choice is
   labeled in a way a player understands without explanation.
2. **Choosing a game file.** "Review a game" asks the player for a file from
   their device. Nothing is uploaded anywhere — the file is read in the
   browser (the app has no backend). The player can back out and return to the
   start screen without choosing a file.
3. **Reading the record.** The file's header tags, starting position and move
   sequence are parsed into something the review screen can play: the opening
   board, and the ordered list of moves with, for each one, which piece moves
   where and which pieces (if any) are removed.
4. **Rejecting what we cannot review, clearly.** A file that is not a game
   record, is recorded under a ruleset this app does not know, uses the plain
   notation, or cannot be replayed on its own starting position (a move from
   an empty square, a capture of nothing, a piece landing on an unremoved
   piece, a side moving the other side's piece) is rejected on the import
   screen with a plain-language message that says what is wrong and — where it
   is a specific move — which move. The player can pick a different file.
5. **The review screen.** The recorded game, on the board we already draw:
   the starting position, with the moves applied one at a time as the player
   walks through them. Each position shows where in the game you are (round
   and side), and the last move made is evident on the board. The board is
   inert — nothing is selectable or movable.
6. **Review controls.** Step forward one move, step back one move, jump to the
   opening position, jump to the final position, and a move list — the game's
   rounds, as recorded — where clicking a move jumps the board to the position
   after it. The move list shows where you currently are.
7. **The recorded result.** At the end of the game, the review shows how the
   record says it ended — who won (red or blue) or that it was a draw, and the
   reason — in the same player-facing language the hot-seat game uses, and
   noted as what the record claims rather than something we worked out.
8. **Leaving.** Both modes have a way back to the start screen. A hot-seat
   game in progress warns that the game will be lost and asks the player to
   confirm; confirming returns to the start screen, cancelling leaves the game
   exactly as it was. A review, and a finished hot-seat game, exit without a
   prompt. Returning to the start screen and choosing again begins cleanly:
   a fresh placement, or a fresh import.
9. **Accessible from the start.** The start screen, the import (including the
   rejection message, which is announced, not just shown), the review controls
   and the move list are all operable by keyboard and conveyed to assistive
   technology, extending the established grid and live-region patterns.
   Stepping through moves announces the position that has been reached.

## Design decisions & constraints

- **The reader mirrors the writer.** Parsing the record is versioned rule-
  adjacent code and lives with the writer it must agree with
  (`src/rules/primary/v1_1/`). It must round-trip: anything
  `renderGameRecord` / `renderPositionBlock` produce (once those emit the
  extended form) must be readable back to the same position and moves.
  Property/round-trip tests are the cheapest way to hold that line.
- **Replay semantics, stated once, applied blindly.** A move `S-D` moves the
  piece on `S` to `D`. An `x` on `D` removes the piece that was on `D` first;
  an `x` on `S` removes the moving piece instead of moving it. So: `S-D`
  quiet move; `S-D x` attacker wins and advances; `S x -D` attacker is lost,
  defender stands; `S x -D x` both are removed. The attacker always advances
  onto a square whose occupant the record removed — including a Sapper taking
  a Tower, and including the Flag. Nothing else — no support, no ranks, no
  reachability — is consulted.
- **Reuse the board, don't rebuild it.** The review screen renders the
  existing board with the existing piece art; it is the play board minus every
  interaction. It must not fork the board component or the piece rendering.
- **The reviewer must not depend on the play session.** Reviewing is its own,
  much simpler state (a starting board, a list of moves, a cursor). It must
  not be bolted onto `PlayState` / `PlaySession`, which carry rule state this
  story has no business maintaining.
- **Board orientation:** the review is always drawn from **red's**
  perspective. There is no hand-off in a review and nothing is secret, so
  there is nothing to flip; the existing "flip board between turns" setting
  (story 00000012) belongs to hot-seat play and is not shown here.
- **Trust the file's tags for the result.** Reading `Result` / `ResultReason`
  is not applying rules. If a record has no result tags, the review simply
  ends at the last recorded position without claiming an outcome.
- **Rejection is a player-facing moment,** not a stack trace: the message
  says what a player can act on ("this file uses the short move notation and
  can't be reviewed", "move 12 (F5-F6) starts from an empty square"), and the
  app stays usable — no crash, no blank screen, whatever file is chosen.
- **Player-facing text** uses the sides' colors, the rules' piece names, and
  the word "move" (never "ply").

## Out of scope

- **Making our own games reviewable** — switching the emitted record to the
  extended form, and saving a played game to a file. Both are later stories
  (owner's decision, 2026-07-13); until they land, review fodder comes from
  the companion repository.
- Playing on from a reviewed position, editing a record, or any board
  interaction in the review.
- Autoplay / animated playback with a timer.
- Validating a recorded game against the rules, flagging illegal moves, or
  recomputing the result.
- Analysis of any kind (evaluations, alternative lines, AI commentary).
- Loading a game by URL, drag-and-drop of files, or remembering recently
  reviewed games.
- Rulesets other than the one(s) this app already implements.
- Any networking, backend, or non-local storage of records.

## Manual-verification gates

- **Gate A — The choice.** The app opens on the start screen. "Play a game"
  reaches placement exactly as before, with nothing about the hot-seat
  experience changed. "Review a game" asks for a file, and backing out returns
  to the start screen.
- **Gate B — Reviewing a real game.** A game recorded by the companion
  repository's engine (extended notation, including captures, sacrifices,
  mutual losses, a Sapper destroying a Tower, and a Flag capture) imports and
  replays correctly: stepping forward moves and removes exactly the pieces the
  record says, stepping back undoes them, jumping to the end reaches the final
  position, jumping to the start returns to the opening, and clicking moves in
  the list lands on the right positions. The result the record claims is shown
  at the end.
- **Gate C — Rejection.** Each of these is rejected on the import screen with
  a message a player can act on, and a different file can then be chosen: a
  file that is not a game record at all (e.g. a photo); a record in the plain
  notation; a record whose move starts from an empty square; a record with an
  `x` that removes nothing; an unknown ruleset.
- **Gate D — Getting out.** Leaving mid-placement and mid-play both warn that
  the game will be lost; cancelling leaves the game untouched and playable;
  confirming returns to the start screen, and starting a new hot-seat game
  begins from an empty placement. Leaving a finished game or a review exits
  without a prompt.
- **Gate E — Accessibility.** With the mouse put away, a game can be imported
  and reviewed end to end by keyboard alone; with a screen reader on, the
  start screen's choices, a rejection message, each move stepped through, and
  the recorded result are all announced; focus stays visible and untrapped
  throughout.

## Open items to resolve at plan time

Presentation and structure only — the policy above is fixed:

- Confirm the record format and notation grammar against the companion
  repository (`doc/ruleset/technical-notes.md`, rules.md §4.4), including how
  strictly to treat header tags we don't use and how forgiving to be about
  whitespace.
- How the app models "which screen am I on" (start / play / review) — the
  smallest thing that works, without turning `App.tsx` into a router.
- The layout of the review screen: where the controls, the move list and the
  result sit relative to the board, reusing existing components where they
  fit.
- Whether the record reader is one module or a parser plus a replayer, and
  where the shared move-notation grammar sits so the reader and the future
  extended-form writer cannot drift apart.
