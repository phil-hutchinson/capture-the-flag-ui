// One of the "How to play" page's ten pictures (story 00000032, Step 6). A
// thin renderer: it reads one `Figure` (`figures.ts`, pure data, engine-
// checked) and its caption (`rulesCopy.ts`) and draws the pieces on their
// board cutout - nothing else yet. No move rings, attack arrows or removal
// marks: Step 7 adds that marker vocabulary. See the implementation plan's
// Decisions 5, 6, 11 and 12 - Decision 11 (a board-less presentation for
// figures 5-10) is superseded by story.md's amendment 3, which restores the
// board cutout to all ten figures; this file draws exactly one presentation.
//
// Every figure draws the same 5x5 patch the window names (Decision 6),
// positioning every piece from the figure's own real square keys and the
// shared `FIGURE_WINDOW` anchor - never a per-figure hand-placed coordinate,
// so a change to `figures.ts` moves the picture automatically. Attacker and
// defender therefore sit on adjacent cells exactly as the rules have them, so
// Step 7's arrow spans one cell boundary in every combat figure, the same way
// it does in figures 3 and 4.
//
// Reuses only `PieceIcon` (`src/art/PieceIcon.tsx`) for the piece artwork
// and this module's own CSS custom property (`--figure-square`, declared in
// `RuleFigure.css`) for scale - nothing from `src/board/` is imported or
// referenced (implementation plan, "Out of bounds").
//
// The whole picture is inert: `aria-hidden`, no click handler, not
// focusable, no animation. The visible `<figcaption>` is the whole of a
// figure's accessible text (Decision 3).

import { PieceIcon } from "../../art/PieceIcon.tsx";
import { FIGURE_WINDOW, type Figure, type FigurePiece } from "./figures.ts";
import { RULES_CAPTIONS } from "./rulesCopy.ts";
import "./RuleFigure.css";

/** A square key's absolute board column/row, e.g. `"F3"` -> `{ column: 5, row: 3 }`. */
function parseSquare(square: string): {
  readonly column: number;
  readonly row: number;
} {
  return {
    column: square.charCodeAt(0) - "A".charCodeAt(0),
    row: Number(square.slice(1)),
  };
}

const WINDOW_ANCHOR = parseSquare(FIGURE_WINDOW.anchor);
const WINDOW_TOP_ROW = WINDOW_ANCHOR.row + FIGURE_WINDOW.height - 1;

/**
 * A square's position within `FIGURE_WINDOW`, 0-based: column offset from
 * the window's left edge (the anchor's column), row offset counted downward
 * from the window's top - so higher board rows sit nearer the top of the
 * picture, matching the live board's own orientation (Decision 6).
 */
function windowCell(square: string): {
  readonly col: number;
  readonly row: number;
} {
  const { column, row } = parseSquare(square);
  return { col: column - WINDOW_ANCHOR.column, row: WINDOW_TOP_ROW - row };
}

interface PlacedPiece {
  readonly piece: FigurePiece;
  readonly col: number;
  readonly row: number;
}

/** A figure's pieces at their own window cells - no translation, no cropping. */
function placements(figure: Figure): readonly PlacedPiece[] {
  return figure.pieces.map((piece) => ({ piece, ...windowCell(piece.square) }));
}

export interface RuleFigureProps {
  readonly figure: Figure;
}

/** One "How to play" picture: a figure's pieces, drawn on a 5x5 board cutout, with a visible caption. */
export function RuleFigure({ figure }: RuleFigureProps) {
  const figurePlacements = placements(figure);

  return (
    <figure className="rule-figure">
      <div className="rule-figure__stage" aria-hidden="true">
        <div
          className="rule-figure__picture"
          style={{
            width: `calc(${FIGURE_WINDOW.width} * var(--figure-square))`,
            height: `calc(${FIGURE_WINDOW.height} * var(--figure-square))`,
          }}
        >
          <BoardSquares />
          {figurePlacements.map(({ piece, col, row }) => (
            <div
              key={piece.square}
              className="rule-figure__piece"
              style={{
                left: `calc(${col} * var(--figure-square))`,
                top: `calc(${row} * var(--figure-square))`,
              }}
            >
              <PieceIcon
                type={piece.pieceType}
                side={piece.side}
                className="rule-figure__piece-icon"
              />
            </div>
          ))}
        </div>
      </div>
      <figcaption className="rule-figure__caption">
        {RULES_CAPTIONS[figure.id]}
      </figcaption>
    </figure>
  );
}

/** The 5x5 patch of squares under every figure (Decision 5): no lake, no board edge treatment, no coordinates. */
function BoardSquares() {
  const cells: Array<{ readonly col: number; readonly row: number }> = [];
  for (let row = 0; row < FIGURE_WINDOW.height; row++) {
    for (let col = 0; col < FIGURE_WINDOW.width; col++) {
      cells.push({ col, row });
    }
  }
  return (
    <>
      {cells.map(({ col, row }) => (
        <div
          key={`${col}-${row}`}
          className="rule-figure__square"
          style={{
            left: `calc(${col} * var(--figure-square))`,
            top: `calc(${row} * var(--figure-square))`,
          }}
        />
      ))}
    </>
  );
}
