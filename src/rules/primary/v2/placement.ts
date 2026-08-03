// Placement state model & core operations for the ruleset major-2 editions
// (`2-0:BATTLE`, `2-1:SKIRMISH`, and the superseded `2-0:SKIRMISH`).
//
// A `PlacementState` tracks one player's in-progress army layout: which of
// that player's own home squares hold a placed piece type, plus the derived
// remaining-inventory (how many of each type are still in the tray).
// Placement is sparse: a complete army is only as large as the chosen
// `ArmyRoster` (Battle 25, Skirmish 16), so a finished layout leaves the rest
// of the home squares empty (23 of Battle's 48; 8 of Skirmish's 24).
// Operations are pure and immutable-style - each returns a *new* state
// rather than mutating its input - so the UI (Steps 8-10) can drive them
// directly and the serializer (Step 5) can read a snapshot safely.
//
// All operations structurally reject any square that is not one of the
// state's own side's home squares (lakes, buffers, and the opponent's zone
// are illegal), and `place` respects remaining counts (cannot place a type
// with zero remaining). Because the UI (Step 7 onward) only ever offers the
// player's own home squares as interactive targets, these are treated as
// programming-invariant violations rather than recoverable user errors:
// violating them throws, rather than silently no-op'ing. Note that `place`,
// `move`, and `swap` do not themselves enforce the Tower-only-rules
// (`towersLegallyPlaced`, `squaresClosedToTowers`) - those are placement-time
// *legality*, judged by the UI (story 00000025's Steps 4-5), not structural
// invariants of the state.
//
// This module builds on the board geometry (Step 1; parametric over a
// `BoardLayout` since story 00000023's Step 3) and the piece catalog /
// army-composition rosters (Step 2, `armyComposition.ts`), and (story
// 00000025) the `TowerPlacement` variant type (`edition.ts`, type-only - no
// dependency cycle, since `edition.ts` never imports this module).
//
// A `PlacementState` carries its own `boardLayout`, `army`, and (story
// 00000025) `towerPlacement`, all required (story 00000023's peer review,
// findings #2 and #15: an omitted `boardLayout` or `army` used to silently
// default to Battle's, which is exactly the class of defect found live at
// that story's Gate B/D - and once only one of the two defaulted,
// `emptyPlacement(side, SKIRMISH_LAYOUT)` would quietly pair Battle's
// 25-piece roster with Skirmish's 24-square home zone, a placement that can
// never be completed). So home squares, the Tower-adjacency rule, the
// Tower-lane closed-square query, auto-fill, and the starting/complete
// inventory are all sized to the board, roster, and variant actually being
// placed for.

import {
  columnIndexOf,
  homeSquares,
  homeSquaresFacingLane,
  isHomeSquareFor,
  squareKey,
  type Side,
  type Square,
} from "./board.ts";
import type { BoardLayout } from "./boardLayout.ts";
import {
  armySize,
  freshInventory,
  type ArmyRoster,
} from "./armyComposition.ts";
import type { TowerPlacement } from "./edition.ts";
import { PIECE_TYPES, type Inventory, type PieceTypeId } from "./pieces.ts";

/**
 * One player's in-progress (or complete) army layout: which board it is
 * being placed on, which army roster it is being filled from, which
 * `TOWER_PLACEMENT` variant value governs its Tower placement (story
 * 00000025), a mapping from that player's home squares (by `squareKey`) to
 * the piece type placed there, and the derived remaining-inventory. Squares
 * absent from `placements` are empty.
 */
export interface PlacementState {
  readonly side: Side;
  readonly boardLayout: BoardLayout;
  readonly army: ArmyRoster;
  readonly towerPlacement: TowerPlacement;
  readonly placements: ReadonlyMap<string, PieceTypeId>;
  readonly remaining: Inventory;
}

/**
 * A fresh placement state for `side` on `boardLayout`, `army`, and
 * `towerPlacement`, all required (pass `BATTLE_LAYOUT`/`BATTLE_ARMY`/
 * `"spacing_only"` explicitly for Battle): no pieces placed, a full tray
 * sized to `army`. Callers holding an `Edition` should pass its own
 * `boardLayout`/`army`/`towerPlacement` so the three can never disagree
 * (story 00000025 widened this from two required arguments to three, for the
 * same reason story 00000023's peer review made the first two required: a
 * silently defaulted variant is the defect class this app must not repeat).
 */
export function emptyPlacement(
  side: Side,
  boardLayout: BoardLayout,
  army: ArmyRoster,
  towerPlacement: TowerPlacement,
): PlacementState {
  return {
    side,
    boardLayout,
    army,
    towerPlacement,
    placements: new Map(),
    remaining: freshInventory(army),
  };
}

function assertOwnHomeSquare(
  state: PlacementState,
  square: Square,
  action: string,
): void {
  if (!isHomeSquareFor(square, state.side, state.boardLayout)) {
    throw new Error(
      `Cannot ${action}: ${squareKey(square)} is not a home square for ${state.side}.`,
    );
  }
}

/** The piece type placed on `square`, or `undefined` if it is empty. */
export function pieceAt(
  state: PlacementState,
  square: Square,
): PieceTypeId | undefined {
  return state.placements.get(squareKey(square));
}

/**
 * Places `pieceType` on `square`. Rejects (throws) if `square` is not one of
 * `state.side`'s own home squares, if `square` is already occupied, or if
 * there is no remaining piece of `pieceType` left in the tray.
 */
export function place(
  state: PlacementState,
  square: Square,
  pieceType: PieceTypeId,
): PlacementState {
  assertOwnHomeSquare(state, square, "place a piece");
  const key = squareKey(square);
  if (state.placements.has(key)) {
    throw new Error(`Cannot place a piece: ${key} is already occupied.`);
  }
  if (state.remaining[pieceType] <= 0) {
    throw new Error(`Cannot place a piece: no ${pieceType} remaining.`);
  }

  const placements = new Map(state.placements);
  placements.set(key, pieceType);
  const remaining: Inventory = {
    ...state.remaining,
    [pieceType]: state.remaining[pieceType] - 1,
  };
  return { ...state, placements, remaining };
}

/**
 * Moves the piece on `from` to `to`. Rejects (throws) if either square is not
 * one of `state.side`'s own home squares, if `from` is empty, or if `to` is
 * already occupied. Remaining counts are unaffected - a move never changes
 * the tray.
 */
export function move(
  state: PlacementState,
  from: Square,
  to: Square,
): PlacementState {
  assertOwnHomeSquare(state, from, "move a piece");
  assertOwnHomeSquare(state, to, "move a piece");
  const fromKey = squareKey(from);
  const toKey = squareKey(to);
  const pieceType = state.placements.get(fromKey);
  if (pieceType === undefined) {
    throw new Error(`Cannot move a piece: ${fromKey} is empty.`);
  }
  if (state.placements.has(toKey)) {
    throw new Error(`Cannot move a piece: ${toKey} is already occupied.`);
  }

  const placements = new Map(state.placements);
  placements.delete(fromKey);
  placements.set(toKey, pieceType);
  return { ...state, placements };
}

/**
 * Swaps the pieces on `squareA` and `squareB`. Rejects (throws) if either
 * square is not one of `state.side`'s own home squares, or if either square
 * is empty (both must already hold a placed piece). Remaining counts are
 * unaffected - a swap never changes the tray.
 */
export function swap(
  state: PlacementState,
  squareA: Square,
  squareB: Square,
): PlacementState {
  assertOwnHomeSquare(state, squareA, "swap pieces");
  assertOwnHomeSquare(state, squareB, "swap pieces");
  const keyA = squareKey(squareA);
  const keyB = squareKey(squareB);
  const pieceA = state.placements.get(keyA);
  const pieceB = state.placements.get(keyB);
  if (pieceA === undefined || pieceB === undefined) {
    throw new Error("Cannot swap pieces: both squares must be occupied.");
  }

  const placements = new Map(state.placements);
  placements.set(keyA, pieceB);
  placements.set(keyB, pieceA);
  return { ...state, placements };
}

/**
 * Returns the piece on `square` to the tray, incrementing its remaining
 * count. Rejects (throws) if `square` is not one of `state.side`'s own home
 * squares, or if `square` is empty.
 */
export function returnToTray(
  state: PlacementState,
  square: Square,
): PlacementState {
  assertOwnHomeSquare(state, square, "return a piece to the tray");
  const key = squareKey(square);
  const pieceType = state.placements.get(key);
  if (pieceType === undefined) {
    throw new Error(`Cannot return a piece to the tray: ${key} is empty.`);
  }

  const placements = new Map(state.placements);
  placements.delete(key);
  const remaining: Inventory = {
    ...state.remaining,
    [pieceType]: state.remaining[pieceType] + 1,
  };
  return { ...state, placements, remaining };
}

/** Clears the whole board: returns every placed piece to the tray. */
export function clear(state: PlacementState): PlacementState {
  return emptyPlacement(
    state.side,
    state.boardLayout,
    state.army,
    state.towerPlacement,
  );
}

/** How many of `pieceType` remain in `state`'s tray. */
export function remainingCount(
  state: PlacementState,
  pieceType: PieceTypeId,
): number {
  return state.remaining[pieceType];
}

/** How many pieces are currently placed on the board (out of `state.army`'s size). */
export function placedCount(state: PlacementState): number {
  return state.placements.size;
}

export interface PlacementProgress {
  readonly placed: number;
  readonly total: number;
}

/** Placement progress as `{ placed, total }`, e.g. for a "12 / 25 placed" readout (`total` is `state.army`'s size). */
export function progress(state: PlacementState): PlacementProgress {
  return { placed: placedCount(state), total: armySize(state.army) };
}

/**
 * True only once every piece of `state.army` has been placed (Battle 25,
 * Skirmish 16). Placement is sparse - a complete army fills only part of a
 * side's home squares (25 of Battle's 48; 16 of Skirmish's 24), leaving the
 * rest intentionally empty.
 */
export function isComplete(state: PlacementState): boolean {
  return placedCount(state) === armySize(state.army);
}

/** True if `a` and `b` are the same square or share an edge/corner (orthogonally or diagonally adjacent). */
function isAdjacentOrSame(a: Square, b: Square): boolean {
  const columnDelta = Math.abs(
    columnIndexOf(a.column) - columnIndexOf(b.column),
  );
  const rowDelta = Math.abs(a.row - b.row);
  return columnDelta <= 1 && rowDelta <= 1;
}

/**
 * True only when none of `state.side`'s currently-placed Towers sit
 * orthogonally or diagonally adjacent to another of that side's Towers (rules
 * §3's placement-only Tower rule). True whenever the side has placed fewer
 * than two Towers. Used by the UI (Step 6) to gate placement confirmation -
 * this is a placement-time rule only; Towers never move, so it is never
 * re-checked during play.
 */
export function towersLegallyPlaced(state: PlacementState): boolean {
  const towerSquares = homeSquares(state.side, state.boardLayout).filter(
    (square) => pieceAt(state, square) === "tower",
  );
  for (let i = 0; i < towerSquares.length; i += 1) {
    for (let j = i + 1; j < towerSquares.length; j += 1) {
      if (isAdjacentOrSame(towerSquares[i], towerSquares[j])) {
        return false;
      }
    }
  }
  return true;
}

/**
 * `state.side`'s home squares a Tower may not stand on in `state`: the Step
 * 2 lane geometry (`homeSquaresFacingLane`) when `state.towerPlacement` is
 * `spacing_and_lanes`, and the empty set when it is `spacing_only` (story
 * 00000025). This is the single place the rest of the app asks "where can't
 * a Tower go here" - it is already correct for Battle (empty by geometry,
 * regardless of variant) and for a historical `2-0:SKIRMISH` placement
 * (empty by variant) with no board- or edition-specific branching of its
 * own. Does not consult what is actually placed on the board - it is the
 * static closed set, not a live legality check (see `towersLegallyPlaced`
 * for the spacing rule, which does).
 */
export function squaresClosedToTowers(state: PlacementState): Square[] {
  if (state.towerPlacement !== "spacing_and_lanes") {
    return [];
  }
  return homeSquaresFacingLane(state.side, state.boardLayout);
}

/**
 * A source of numbers in `[0, 1)`, matching the shape of `Math.random`.
 * Injectable so `autoFill` is deterministic under test (pass a seeded
 * generator) while defaulting to real randomness in the UI.
 */
export type RandomSource = () => number;

/** Fisher-Yates shuffle using `random` as the source of randomness. */
function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Chooses `count` squares from `candidates` for the remaining Towers to
 * place, such that none of them ends up orthogonally or diagonally adjacent
 * to another of this side's Towers - either one of `alreadyPlacedTowers` or
 * one chosen alongside it here. `candidates` is expected to already exclude
 * any square closed to Towers (`squaresClosedToTowers`, story 00000025) -
 * this helper only knows about the spacing rule. Tries several random
 * shuffles of `candidates` (an independent set of this size is easy to find
 * among the side's home squares for the edition's handful of Towers, so a
 * handful of attempts suffices in practice) before giving up. Returns the
 * chosen squares.
 */
function pickTowerSquares(
  candidates: readonly Square[],
  count: number,
  alreadyPlacedTowers: readonly Square[],
  random: RandomSource,
): Square[] {
  if (count === 0) {
    return [];
  }

  const MAX_ATTEMPTS = 500;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const shuffled = shuffle(candidates, random);
    const chosen: Square[] = [];
    const committed: Square[] = [...alreadyPlacedTowers];

    for (const candidate of shuffled) {
      if (chosen.length === count) break;
      if (!committed.some((tower) => isAdjacentOrSame(tower, candidate))) {
        chosen.push(candidate);
        committed.push(candidate);
      }
    }

    if (chosen.length === count) {
      return chosen;
    }
  }

  throw new Error(
    "autoFill: could not find Tower squares satisfying the no-adjacent-Towers rule.",
  );
}

/**
 * Places every one of `state`'s remaining pieces onto a randomly chosen
 * subset of `state`'s currently-empty home squares - not every empty square,
 * since placement is sparse (rules §3): only `state.army`'s size (Battle 25
 * of 48; Skirmish 16 of 24) of a side's home squares ever hold a piece.
 * Already-placed pieces are left untouched,
 * and only `state.side`'s own home squares are ever touched (never lakes,
 * buffers, or the opponent's zone). The remaining Towers are placed first,
 * choosing only among squares `squaresClosedToTowers` does not close (story
 * 00000025 - a no-op restriction on Battle and on a `spacing_only` Skirmish
 * placement, since that query is empty there), so that neither they nor any
 * already-placed Tower ends up orthogonally or diagonally adjacent to
 * another of this side's Towers (rules §3's Tower rule) nor in front of a
 * lane where that variant applies; the remaining non-Tower pieces then fill
 * a random subset of what is left, closed squares included - the lane
 * restriction only ever applies to Towers.
 *
 * `random` defaults to `Math.random` (real randomness for the UI); pass a
 * seeded `RandomSource` for deterministic, reproducible results in tests.
 */
export function autoFill(
  state: PlacementState,
  random: RandomSource = Math.random,
): PlacementState {
  const emptySquares = homeSquares(state.side, state.boardLayout).filter(
    (square) => pieceAt(state, square) === undefined,
  );

  const piecesToPlace: PieceTypeId[] = [];
  for (const id of PIECE_TYPES) {
    for (let i = 0; i < state.remaining[id]; i += 1) {
      piecesToPlace.push(id);
    }
  }
  const towersToPlace = piecesToPlace.filter((id) => id === "tower").length;
  const nonTowerPieces = shuffle(
    piecesToPlace.filter((id) => id !== "tower"),
    random,
  );

  const alreadyPlacedTowers = homeSquares(state.side, state.boardLayout).filter(
    (square) => pieceAt(state, square) === "tower",
  );

  const closedSquareKeys = new Set(squaresClosedToTowers(state).map(squareKey));
  const towerCandidates = emptySquares.filter(
    (square) => !closedSquareKeys.has(squareKey(square)),
  );
  const towerSquares = pickTowerSquares(
    towerCandidates,
    towersToPlace,
    alreadyPlacedTowers,
    random,
  );

  const towerSquareKeys = new Set(towerSquares.map(squareKey));
  const squaresAfterTowers = emptySquares.filter(
    (square) => !towerSquareKeys.has(squareKey(square)),
  );
  const nonTowerSquares = shuffle(squaresAfterTowers, random).slice(
    0,
    nonTowerPieces.length,
  );

  let result = state;
  for (const square of towerSquares) {
    result = place(result, square, "tower");
  }
  for (let i = 0; i < nonTowerSquares.length; i += 1) {
    result = place(result, nonTowerSquares[i], nonTowerPieces[i]);
  }
  return result;
}
