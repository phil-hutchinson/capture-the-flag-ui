// Phase 2 play-state model & move application for ruleset PRIMARY:1.1.
//
// A `PlayState` tracks an in-progress Phase-2 game: the current board, whose
// turn it is to move, and the ordered list of moves made so far in the
// simple `A2A3` coordinate form (source square immediately followed by
// destination square, no separator - rules.md §4.4, unchanged for attacks:
// no combat-resolution markers - see story 00000005's Design decisions).
// This is the minimum structure recorded-game replay can build on later;
// this story does not implement replay itself.
//
// Operations are pure and immutable-style - `applyMove` returns a *new*
// state rather than mutating its input - matching placement.ts. Because the
// UI only ever offers a legal destination or a legal attack target
// (structural prevention), `applyMove` treats anything else as a
// programming-invariant violation: it throws rather than silently
// no-op'ing.
//
// A destination among `legalDestinations` (movement.ts) is a plain move: the
// piece relocates. A destination among `legalAttacks` (movement.ts, story
// 00000005 Step 3) is an attack: it is resolved via `resolveCombat`
// (combat.ts, story 00000005 Steps 1-2) and the board updates per the
// outcome (attacker wins / attacker loses / mutual loss). The two
// destination sets are always disjoint - an enemy-occupied square is never a
// `legalDestinations` result - so there is never ambiguity about which
// applies. `applyMove` exposes the resolved `PlyOutcome` alongside the new
// state so callers (the session layer, story 00000006's game-end detection)
// can react to what the ply actually did without re-deriving it.
//
// This module builds on the board geometry (board.ts), the movement and
// attack-target rules (movement.ts, stories 00000004/00000005), the combat
// resolution rules (combat.ts, story 00000005), and the initial-game-state
// artifact (gameState.ts, story 00000001); it has no further dependencies.

import { squareKey, type Side, type Square } from "./board.ts";
import { resolveCombat, type CombatOutcome } from "./combat.ts";
import {
  renderPositionBlock,
  type BoardState,
  type InitialGameState,
  type PlacedPiece,
} from "./gameState.ts";
import { legalAttacks, legalDestinations } from "./movement.ts";

/** The side that moves first, per rules.md §4.1 (White/Red moves first). */
const FIRST_SIDE: Side = "white";

/**
 * An in-progress Phase-2 game: the ruleset it was played under, the
 * *starting* board (the revealed position play began from - kept alongside
 * the current board so the record render, below, can always reproduce the
 * record file format's position block, which is always the *starting*
 * position, never the current one), the current board, whose turn it is, and
 * every move made so far, in order, as `A2A3` coordinate strings (absolute
 * White frame - see board.ts).
 */
export interface PlayState {
  readonly ruleset: string;
  readonly initialBoard: BoardState;
  readonly board: BoardState;
  readonly sideToMove: Side;
  readonly moves: readonly string[];
}

/**
 * The opening `PlayState` for `initial` (story 00000001's completed-placement
 * artifact): the same board (as both the starting and current board), White
 * (Red) to move first, no moves made yet, and the ruleset carried over
 * unchanged.
 */
export function startPlay(initial: InitialGameState): PlayState {
  return {
    ruleset: initial.ruleset,
    initialBoard: initial.board,
    board: initial.board,
    sideToMove: FIRST_SIDE,
    moves: [],
  };
}

const OTHER_SIDE: Readonly<Record<Side, Side>> = {
  white: "black",
  black: "white",
};

/**
 * The outcome of a single ply applied via `applyMove`: either a resolved
 * combat encounter (`kind: "attack"`, carrying every field of
 * `resolveCombat`'s `CombatOutcome` - combat.ts, story 00000005 Steps 1-2) or,
 * for a plain move onto an empty square, a "just a move" record
 * (`kind: "move"`) naming the piece that moved and the square it moved to -
 * deliberately with no attacker/defender/capture to report, since nothing
 * fought. Callers (the session layer, and story 00000006's game-end
 * detection) discriminate on `kind`.
 */
export type PlyOutcome =
  | ({ readonly kind: "attack" } & CombatOutcome)
  | {
      readonly kind: "move";
      readonly piece: PlacedPiece;
      readonly square: Square;
    };

/**
 * Applies a single ply - a plain move or an attack - moving the piece on
 * `from` to `to`, and returns a *new* `PlayState` (the input is never
 * mutated) together with the resolved `PlyOutcome`.
 *
 * If `to` is among `legalDestinations(state.board, from)` this is a plain
 * move: the piece relocates and the outcome is `{ kind: "move", ... }`. If
 * `to` is instead among `legalAttacks(state.board, from)` this is an attack:
 * it is resolved via `resolveCombat` and the board updates per the result -
 * **attacker wins** removes the defender and moves the attacker onto `to`;
 * **attacker loses** removes the attacker and leaves the defender in place;
 * **mutual loss** removes both, leaving `to` empty - and the outcome is
 * `{ kind: "attack", ...combatOutcome }`.
 *
 * In every case the side to move flips and the move is appended to
 * `state.moves` in the same plain `A2A3` coordinate string
 * (`squareKey(from) + squareKey(to)`) - no combat-resolution markers, even
 * for an attack.
 *
 * Rejects (throws) if `from` does not hold a piece belonging to
 * `state.sideToMove`, or if `to` is neither a legal destination nor a legal
 * attack target for that piece - the UI never offers such a move, so this is
 * a programming-invariant guard, not a user-facing error.
 */
export function applyMove(
  state: PlayState,
  from: Square,
  to: Square,
): { readonly state: PlayState; readonly outcome: PlyOutcome } {
  const fromKey = squareKey(from);
  const toKey = squareKey(to);
  const piece = state.board[fromKey];
  if (piece === undefined || piece.side !== state.sideToMove) {
    throw new Error(
      `Cannot apply move: ${fromKey} does not hold a piece belonging to ${state.sideToMove}.`,
    );
  }

  const isAttack = legalAttacks(state.board, from).some(
    (square) => squareKey(square) === toKey,
  );
  const isMove =
    !isAttack &&
    legalDestinations(state.board, from).some(
      (square) => squareKey(square) === toKey,
    );
  if (!isAttack && !isMove) {
    throw new Error(
      `Cannot apply move: ${toKey} is not a legal destination or attack target for the piece on ${fromKey}.`,
    );
  }

  const board: Record<string, PlacedPiece> = { ...state.board };
  let outcome: PlyOutcome;

  if (isAttack) {
    const combat = resolveCombat(state.board, from, to);
    delete board[fromKey];
    delete board[toKey];
    if (combat.result === "attackerWins") {
      board[toKey] = piece;
    } else if (combat.result === "attackerLoses") {
      board[toKey] = combat.defender;
    }
    // mutualLoss: both squares stay empty - already deleted above.
    outcome = { kind: "attack", ...combat };
  } else {
    delete board[fromKey];
    board[toKey] = piece;
    outcome = { kind: "move", piece, square: to };
  }

  return {
    state: {
      ...state,
      board,
      sideToMove: OTHER_SIDE[state.sideToMove],
      moves: [...state.moves, fromKey + toKey],
    },
    outcome,
  };
}

/**
 * Renders `state` as an inspectable, developer-facing text form that
 * anticipates the companion repository's recorded-game replay file format
 * (`doc/ruleset/technical-notes.md`, "Record file format") without
 * implementing replay itself. It carries the three load-bearing pieces of
 * that format:
 *
 * - the `Ruleset` header tag, in the same `[Name "value"]` syntax the record
 *   file format uses for header tags;
 * - the **position block** for the *starting* position play began from
 *   (`state.initialBoard`, via `renderPositionBlock` - not the current
 *   board, which evolves as moves are applied);
 * - the **move sequence**, grouped into rounds numbered from 1, each written
 *   `N. <whiteMove> <blackMove>` (a game whose last move was White's shows
 *   that trailing round with only the White move) - in the plain `A2A3`
 *   form, with no separators and no combat-resolution markers even for an
 *   attack (rules.md §4.4 - an attack's result always follows automatically
 *   from the position and the rules).
 *
 * This is deliberately not a full record file (no `Event`/`Site`/`Date`/etc.
 * roster tags, no `Result`): it is the minimum a future replay story can
 * build on, kept as a plain string.
 */
export function renderGameRecord(state: PlayState): string {
  const positionBlock = renderPositionBlock({
    ruleset: state.ruleset,
    board: state.initialBoard,
  });

  const rounds: string[] = [];
  for (let i = 0; i < state.moves.length; i += 2) {
    const roundNumber = i / 2 + 1;
    const whiteMove = state.moves[i];
    const blackMove = state.moves[i + 1];
    rounds.push(
      blackMove === undefined
        ? `${roundNumber}. ${whiteMove}`
        : `${roundNumber}. ${whiteMove} ${blackMove}`,
    );
  }

  const sections = [`[Ruleset "${state.ruleset}"]`, positionBlock];
  // Omit the move-sequence section entirely before any move is made, so the
  // record doesn't end with a trailing empty section.
  if (rounds.length > 0) {
    sections.push(rounds.join("\n"));
  }
  return sections.join("\n\n");
}
