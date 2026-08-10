// Checks `figures.ts`'s ten pictures against the real rule engine (story
// 00000032's implementation plan, Step 1). Every figure's marked squares and
// every combat figure's outcome are asserted to equal what `movement.ts` and
// `combat.ts` actually say - so a picture cannot quietly go stale when a
// rule changes. A failure here means a **figure** is wrong; it is never a
// reason to change `src/rules/`.

import { describe, expect, it } from "vitest";
import {
  allSquares,
  columnIndexOf,
  isLake,
  squareKey,
  type Square,
} from "../../rules/primary/v2/board.ts";
import { columnLetter } from "../../rules/primary/v2/boardLayout.ts";
import type { CombatOutcome } from "../../rules/primary/v2/combat.ts";
import { resolveCombat } from "../../rules/primary/v2/combat.ts";
import {
  configureRules,
  type RuleConfiguration,
} from "../../rules/primary/v2/configuration.ts";
import { BATTLE_EDITION } from "../../rules/primary/v2/edition.ts";
import type {
  BoardState,
  PlacedPiece,
} from "../../rules/primary/v2/gameState.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../../rules/primary/v2/movement.ts";
import { PIECE_CATALOG } from "../../rules/primary/v2/pieces.ts";
import type { RuleFlagValue } from "../../rules/primary/v2/ruleFlags.ts";
import {
  FIGURE_WINDOW,
  FIGURES,
  type Figure,
  type FigureId,
} from "./figures.ts";

/** Parses an absolute square key (e.g. "F3") back into a `Square`. */
function squareFromKey(key: string): Square {
  return { column: key.charAt(0), row: Number(key.slice(1)) };
}

/** Builds a `BoardState` from a figure's own piece list. */
function boardFromFigure(figure: Figure): BoardState {
  const board: Record<string, PlacedPiece> = {};
  for (const piece of figure.pieces) {
    board[piece.square] = { side: piece.side, pieceType: piece.pieceType };
  }
  return board;
}

/** Sorts `Square`s into their square-key strings, for order-independent comparison. */
function sortedSquareKeys(squares: readonly Square[]): string[] {
  return squares.map(squareKey).sort();
}

function figureById(id: FigureId): Figure {
  const figure = FIGURES.find((candidate) => candidate.id === id);
  if (figure === undefined) {
    throw new Error(`figures.ts declares no figure with id "${id}".`);
  }
  return figure;
}

/** The window's 25 squares, as `Square`s. */
const windowAnchor = squareFromKey(FIGURE_WINDOW.anchor);
const windowAnchorColumnIndex = columnIndexOf(windowAnchor.column);
const windowSquares: Square[] = [];
for (let dc = 0; dc < FIGURE_WINDOW.width; dc++) {
  for (let dr = 0; dr < FIGURE_WINDOW.height; dr++) {
    windowSquares.push({
      column: columnLetter(windowAnchorColumnIndex + dc),
      row: windowAnchor.row + dr,
    });
  }
}
const windowSquareKeys = new Set(windowSquares.map(squareKey));

describe("the cutout window", () => {
  it("keeps every one of its 25 squares on the Battle board and off any lake", () => {
    const boardSquareKeys = new Set(
      allSquares(FIGURE_WINDOW.layout).map(squareKey),
    );
    expect(windowSquares).toHaveLength(25);
    for (const square of windowSquares) {
      expect(boardSquareKeys.has(squareKey(square))).toBe(true);
      expect(isLake(square, FIGURE_WINDOW.layout)).toBe(false);
    }
  });

  it("gives the centre (F3) all eight of its one- and two-away orthogonal squares, on-board and lake-free", () => {
    // These are exactly figure 1's eight destinations - the Decision 6
    // caveat that the window's top and bottom rows touch the board edge
    // must not truncate any figure's claim.
    const centreNeighbours = ["D3", "E3", "F1", "F2", "F4", "F5", "G3", "H3"];
    const boardSquareKeys = new Set(
      allSquares(FIGURE_WINDOW.layout).map(squareKey),
    );
    for (const key of centreNeighbours) {
      const square = squareFromKey(key);
      expect(boardSquareKeys.has(squareKey(square))).toBe(true);
      expect(isLake(square, FIGURE_WINDOW.layout)).toBe(false);
    }
  });
});

describe("placement sanity", () => {
  for (const figure of FIGURES) {
    it(`figure "${figure.id}": all pieces sit inside the window, on distinct, non-lake squares`, () => {
      const seen = new Set<string>();
      for (const piece of figure.pieces) {
        expect(seen.has(piece.square)).toBe(false);
        seen.add(piece.square);
        expect(windowSquareKeys.has(piece.square)).toBe(true);
        expect(isLake(squareFromKey(piece.square), FIGURE_WINDOW.layout)).toBe(
          false,
        );
      }
    });
  }
});

describe("movement figures agree with legalDestinations", () => {
  it('figure "movement" marks exactly the eight squares legalDestinations gives an unencumbered piece', () => {
    const figure = figureById("movement");
    const marking = figure.marking;
    if (marking.kind !== "move") {
      throw new Error('expected figure "movement" to carry a move marking');
    }
    const destinations = legalDestinations(
      boardFromFigure(figure),
      squareFromKey(marking.origin),
      FIGURE_WINDOW.layout,
    );
    expect(destinations).toHaveLength(8);
    expect(sortedSquareKeys(destinations)).toEqual(
      [...marking.destinations].sort(),
    );
  });

  it('figure "slowedMovement" marks exactly the four squares legalDestinations gives an encumbered piece', () => {
    const figure = figureById("slowedMovement");
    const marking = figure.marking;
    if (marking.kind !== "move") {
      throw new Error(
        'expected figure "slowedMovement" to carry a move marking',
      );
    }
    const destinations = legalDestinations(
      boardFromFigure(figure),
      squareFromKey(marking.origin),
      FIGURE_WINDOW.layout,
    );
    expect(destinations).toHaveLength(4);
    expect(sortedSquareKeys(destinations)).toEqual(
      [...marking.destinations].sort(),
    );
  });
});

const ATTACK_FIGURE_IDS: readonly FigureId[] = [
  "attackOrthogonal",
  "attackDiagonal",
  "combatRank1Wins",
  "combatRank3Loses",
  "combatEqualRank",
  "combatTower",
  "combatRankUpAttack",
  "combatRankUpDefend",
];

const DIAGONAL_ATTACKABLE_VALUES: readonly RuleFlagValue<"DIAGONAL_ATTACKABLE">[] =
  ["movable_only", "all"];
const DIAGONAL_ATTACK_PATH_VALUES: readonly RuleFlagValue<"DIAGONAL_ATTACK_PATH">[] =
  ["always", "open_path"];

describe("attack figures agree with legalAttacks under every diagonal-flag combination", () => {
  for (const id of ATTACK_FIGURE_IDS) {
    for (const diagonalAttackable of DIAGONAL_ATTACKABLE_VALUES) {
      for (const diagonalAttackPath of DIAGONAL_ATTACK_PATH_VALUES) {
        it(`figure "${id}" is the only legal attack under DIAGONAL_ATTACKABLE=${diagonalAttackable}, DIAGONAL_ATTACK_PATH=${diagonalAttackPath}`, () => {
          const figure = figureById(id);
          const marking = figure.marking;
          if (marking.kind !== "attack") {
            throw new Error(
              `expected figure "${id}" to carry an attack marking`,
            );
          }
          const configuration: RuleConfiguration = configureRules(
            BATTLE_EDITION,
            {
              DIAGONAL_ATTACKABLE: diagonalAttackable,
              DIAGONAL_ATTACK_PATH: diagonalAttackPath,
            },
          );
          const attacks = legalAttacks(
            boardFromFigure(figure),
            squareFromKey(marking.from),
            configuration,
          );
          expect(sortedSquareKeys(attacks)).toEqual([marking.to]);
        });
      }
    }
  }
});

/** The squares `outcome` removes, per `resolveCombat`'s result. */
function removedSquares(
  outcome: CombatOutcome,
  from: string,
  to: string,
): string[] {
  switch (outcome.result) {
    case "attackerWins":
      return [to];
    case "attackerLoses":
      return [from];
    case "mutualLoss":
      return [from, to];
  }
}

const COMBAT_FIGURES: readonly {
  id: FigureId;
  expectedRemovedCount: number;
}[] = [
  { id: "combatRank1Wins", expectedRemovedCount: 1 },
  { id: "combatRank3Loses", expectedRemovedCount: 1 },
  { id: "combatEqualRank", expectedRemovedCount: 2 },
  { id: "combatTower", expectedRemovedCount: 2 },
  { id: "combatRankUpAttack", expectedRemovedCount: 2 },
  { id: "combatRankUpDefend", expectedRemovedCount: 2 },
];

describe("combat figures agree with resolveCombat", () => {
  for (const { id, expectedRemovedCount } of COMBAT_FIGURES) {
    it(`figure "${id}": resolveCombat removes exactly the figure's declared squares`, () => {
      const figure = figureById(id);
      const marking = figure.marking;
      if (marking.kind !== "attack") {
        throw new Error(`expected figure "${id}" to carry an attack marking`);
      }
      expect(marking.removed).toHaveLength(expectedRemovedCount);

      const outcome = resolveCombat(
        boardFromFigure(figure),
        squareFromKey(marking.from),
        squareFromKey(marking.to),
        FIGURE_WINDOW.layout,
      );
      const removed = removedSquares(outcome, marking.from, marking.to);
      expect(removed.sort()).toEqual([...marking.removed].sort());
    });
  }
});

describe("the story's standing constraints", () => {
  it('figure "attackDiagonal"\'s target is a numbered piece, never Tower or Flag, and both flanking squares are empty', () => {
    const figure = figureById("attackDiagonal");
    const marking = figure.marking;
    if (marking.kind !== "attack") {
      throw new Error(
        'expected figure "attackDiagonal" to carry an attack marking',
      );
    }
    const target = figure.pieces.find((piece) => piece.square === marking.to);
    expect(target).toBeDefined();
    expect(PIECE_CATALOG[target!.pieceType].rankCode).not.toBeNull();

    // For an attack from F3 to G4 (dc=1, dr=1), the two flanking squares are
    // G3 (origin's row, target's column) and F4 (origin's column, target's
    // row) - see movement.ts's `legalAttacks`, DIAGONAL_ATTACK_PATH handling.
    const board = boardFromFigure(figure);
    expect(board[squareKey({ column: "G", row: 3 })]).toBeUndefined();
    expect(board[squareKey({ column: "F", row: 4 })]).toBeUndefined();
  });

  it('figure "combatTower"\'s attack is orthogonal, never diagonal, and its target is a Tower', () => {
    const figure = figureById("combatTower");
    const marking = figure.marking;
    if (marking.kind !== "attack") {
      throw new Error(
        'expected figure "combatTower" to carry an attack marking',
      );
    }
    const from = squareFromKey(marking.from);
    const to = squareFromKey(marking.to);
    expect(from.column === to.column || from.row === to.row).toBe(true);

    const target = figure.pieces.find((piece) => piece.square === marking.to);
    expect(target?.pieceType).toBe("tower");
  });

  it('figures "attackOrthogonal" and "attackDiagonal" are two separate figures with different boards', () => {
    const orthogonal = figureById("attackOrthogonal");
    const diagonal = figureById("attackDiagonal");
    expect(orthogonal.id).not.toBe(diagonal.id);
    expect(boardFromFigure(orthogonal)).not.toEqual(boardFromFigure(diagonal));
  });
});
