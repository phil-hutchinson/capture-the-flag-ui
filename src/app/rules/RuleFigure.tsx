// One of the "How to play" page's ten pictures (story 00000032). A thin
// renderer: it reads one `Figure` (`figures.ts`, pure data, engine-checked)
// and its caption (`rulesCopy.ts`) and draws the pieces on their board
// cutout, together with the marker vocabulary Step 7 adds on top: move
// rings, attack arrows and removal marks. See the implementation plan's
// Decisions 1, 2, 5, 6, 11 and 12 - Decision 11 (a board-less presentation
// for figures 5-10) is superseded by story.md's amendment 3, which restores
// the board cutout to all ten figures; this file draws exactly one
// presentation.
//
// Every figure draws the same 5x5 patch the window names (Decision 6),
// positioning every piece - and every marker - from the figure's own real
// square keys and the shared `FIGURE_WINDOW` anchor - never a per-figure
// hand-placed coordinate, so a change to `figures.ts` moves the picture (and
// its arrows) automatically. Attacker and defender therefore sit however
// `figures.ts` places them (adjacent in figures 3 and 4, two squares apart
// with an empty square between in the six combat figures - story.md
// amendment 5), and the arrow's size and placement are derived from that
// same gap, per story.md's amendment 7 (see the sizing comment above
// `Markers`' attack branch).
//
// Draw order, back to front (Decision 2): board squares -> arrows (drawn
// behind the pieces, since a marker must never paint over a piece) ->
// pieces -> removal marks (a dimmed piece icon plus a black X drawn on top
// of everything, including the arrowhead). This follows from DOM order
// alone: every layer here is `position: absolute` with no `z-index`, so
// later-in-DOM paints on top, with no stacking-context bookkeeping needed.
//
// Two marker shapes only (Decision 1), both drawn in `--ink`, never a side
// colour, so colour carries no meaning on its own:
//  - a **move** marker - a thin shaft ending in an open (unfilled) ring on
//    the reachable square (figures 1 and 2);
//  - an **attack** marker - a short, wide shaft ending in a solid triangular
//    arrowhead that stops short of the attacked square rather than landing
//    on it (figures 3-10, the same shape whether or not a fight is
//    resolved, so the "may attack" and "did attack" pictures never look
//    like two different things the page never explains). Sized per
//    story.md's amendment 7 - see the sizing comment above `Markers`' attack
//    branch for the two size profiles and why the arrow stops short.
// A move figure's shafts are all drawn before any of its rings, so a
// two-square destination's shaft (which passes straight through a
// one-square destination's ring) sits under that ring rather than over it.
//
// A removed piece (figures 5-10) is marked two ways: its `PieceIcon` is
// dimmed to low opacity, and a black X - each stroke given a `--parchment`
// halo so it reads over both `--side-a` and `--side-b` - is drawn on top,
// bounded to the lower part of the cell so it never covers the piece's
// rank numeral, which `PieceIcon` pins in the top-left corner (amendment 4).
// The halo is drawn beneath the X's own strokes and is not itself dimmed,
// so the removal mark stays fully legible even though the piece under it
// is faded.
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
import {
  FIGURE_WINDOW,
  type Figure,
  type FigureMarking,
  type FigurePiece,
} from "./figures.ts";
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

/**
 * A square's centre, in the same units as the marker `<svg>`'s `viewBox`
 * (one unit per cell - see `Markers` below), derived from the same
 * `windowCell` every piece is positioned with.
 */
function cellCenter(square: string): {
  readonly x: number;
  readonly y: number;
} {
  const { col, row } = windowCell(square);
  return { x: col + 0.5, y: row + 0.5 };
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

/** One "How to play" picture: a figure's pieces and markers, drawn on a 5x5 board cutout, with a visible caption. */
export function RuleFigure({ figure }: RuleFigureProps) {
  const figurePlacements = placements(figure);
  const removedSquares =
    figure.marking.kind === "attack"
      ? new Set(figure.marking.removed)
      : EMPTY_SET;

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
          <Markers marking={figure.marking} />
          {figurePlacements.map(({ piece, col, row }) => {
            const removed = removedSquares.has(piece.square);
            return (
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
                  className={
                    removed
                      ? "rule-figure__piece-icon rule-figure__piece-icon--removed"
                      : "rule-figure__piece-icon"
                  }
                />
                {removed && <RemovalMark />}
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="rule-figure__caption">
        {RULES_CAPTIONS[figure.id]}
      </figcaption>
    </figure>
  );
}

const EMPTY_SET: ReadonlySet<string> = new Set();

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

/** An open ring's radius, in cell units (one unit = one `--figure-square` cell). */
const MOVE_RING_RADIUS = 0.26;

/**
 * The attack arrow's sizing (story.md amendment 7, added after the owner saw
 * Step 7's first attempt and found the arrow too long and too thin to read
 * at a glance). Two size profiles, chosen by how far apart the attacker and
 * defender actually are - never a per-figure hand-tuned value:
 *
 *  - a **stub**, for figures 3 and 4, where attacker and defender are one
 *    square apart (orthogonally or diagonally): the arrow keeps the centre
 *    point it has always had - the midpoint between the two piece centres -
 *    but shrinks to half its previous length (tuned down from an
 *    intermediate two-thirds, which still grazed the pieces) and doubles in
 *    width;
 *  - a **combat** arrow, for figures 5-10, where attacker and defender are
 *    two squares apart with one empty square between them: the arrow is
 *    sized to sit entirely inside that empty square, clear of both pieces,
 *    and is about three times its previous width. Its centre is then nudged
 *    forward - along the attack vector, not "up" or "down" - by
 *    `COMBAT_ARROW_FORWARD_OFFSET`, so it sits slightly closer to the
 *    defender than dead centre in the empty square; the nudge is capped so
 *    the arrow still ends up fully inside that square (see the offset
 *    calculation below).
 *
 * In both cases the arrow now stops short of the defending piece. An
 * earlier draft let the head's tip land exactly on the target square's
 * centre, so the overlap implied "the attacker moves to the destination
 * square"; the owner preferred a short, wide arrow that reads as
 * directional at a glance, and that implication now rests on the section's
 * own sentence instead (Decision 1, Decision 2). Do not reintroduce that
 * overlap.
 *
 * `BASE_ATTACK_HEAD_WIDTH`/`BASE_ATTACK_SHAFT_WIDTH` are Step 7's original
 * (pre-amendment) measurements, kept only as the multiplier basis below.
 */
const BASE_ATTACK_HEAD_WIDTH = 0.32;
const BASE_ATTACK_SHAFT_WIDTH = 0.1;

const STUB_LENGTH_FACTOR = 1 / 2;
const STUB_WIDTH_FACTOR = 2;

/**
 * Length of the "combat" arrow (figures 5-10), in cell units, centred on
 * the one empty square between attacker and defender: short enough to leave
 * a visible margin on both sides within that single cell, so it never
 * touches, reaches or overlaps either piece's square.
 */
const COMBAT_ARROW_LENGTH = 0.7;
const COMBAT_WIDTH_FACTOR = 3;

/**
 * How far the "combat" arrow's centre (figures 5-10 only) is nudged along
 * the attack vector - from the attacker towards the defender - so it sits
 * slightly forward of the empty square's own centre rather than dead centre
 * in it (story.md amendment 7). In practice this reads as "up" for the five
 * red attacks and "down" for figure 10's blue one, but nothing here branches
 * on direction or on a figure's id: `unitX`/`unitY` (the attacker-to-defender
 * unit vector) already point the right way for any attack, orthogonal or
 * diagonal.
 */
const COMBAT_ARROW_FORWARD_OFFSET = 0.1;

/**
 * Distance (cell units) below which two attacked squares count as "one
 * square apart" (figure 3: 1; figure 4: sqrt(2) ~= 1.41) rather than "two
 * squares apart with an empty square between" (figures 5-10: exactly 2) -
 * comfortably between the two, so the choice never hinges on floating-point
 * exactness.
 */
const ADJACENT_ATTACK_DISTANCE_THRESHOLD = 1.5;

/**
 * The arrowhead's length as a fraction of the whole arrow's length, in both
 * size profiles - long enough that the head reads unmistakably as a head,
 * short enough to leave a visible shaft behind it.
 */
const HEAD_LENGTH_FRACTION = 0.45;

/**
 * A figure's markers (Decision 1), drawn as one `<svg>` overlaying the whole
 * 5x5 picture, positioned before the piece divs in the DOM so it paints
 * behind them (Decision 2). `viewBox` uses one unit per cell, so every
 * coordinate here is derived directly from `cellCenter`/`windowCell` -
 * exactly the same lattice the pieces themselves are placed on - and never a
 * hand-tuned per-figure number.
 */
function Markers({ marking }: { readonly marking: FigureMarking }) {
  const viewBox = `0 0 ${FIGURE_WINDOW.width} ${FIGURE_WINDOW.height}`;

  if (marking.kind === "move") {
    const origin = cellCenter(marking.origin);
    const destinations = marking.destinations.map(cellCenter);
    return (
      <svg
        className="rule-figure__markers"
        viewBox={viewBox}
        preserveAspectRatio="none"
      >
        {/* All shafts first, then all rings on top (Decision 1): a
            two-square destination's shaft passes straight through a
            one-square destination's ring, and the ring must sit above it. */}
        {destinations.map((destination, index) => (
          <line
            key={`shaft-${String(index)}`}
            className="rule-figure__move-shaft"
            x1={origin.x}
            y1={origin.y}
            x2={destination.x}
            y2={destination.y}
          />
        ))}
        {destinations.map((destination, index) => (
          <circle
            key={`ring-${String(index)}`}
            className="rule-figure__move-ring"
            cx={destination.x}
            cy={destination.y}
            r={MOVE_RING_RADIUS}
          />
        ))}
      </svg>
    );
  }

  const from = cellCenter(marking.from);
  const to = cellCenter(marking.to);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  // A degenerate (zero-length) attack never occurs in `figures.ts` - every
  // attack figure's `from` and `to` are distinct squares - so `distance` is
  // always positive; this stays generic rather than assuming a direction.
  const unitX = dx / distance;
  const unitY = dy / distance;
  const midpointX = (from.x + to.x) / 2;
  const midpointY = (from.y + to.y) / 2;

  // Which size profile applies is derived from the actual distance between
  // the two piece centres - never from the figure's id - so a figure that
  // changes its squares can never leave a stale arrow behind.
  const isAdjacentAttack = distance < ADJACENT_ATTACK_DISTANCE_THRESHOLD;
  const length = isAdjacentAttack
    ? distance * STUB_LENGTH_FACTOR
    : COMBAT_ARROW_LENGTH;
  const headWidth =
    BASE_ATTACK_HEAD_WIDTH *
    (isAdjacentAttack ? STUB_WIDTH_FACTOR : COMBAT_WIDTH_FACTOR);
  const shaftWidth =
    BASE_ATTACK_SHAFT_WIDTH *
    (isAdjacentAttack ? STUB_WIDTH_FACTOR : COMBAT_WIDTH_FACTOR);

  // The six combat figures (5-10) nudge the arrow's centre forward - along
  // the attack vector, never "up" or "down" by name - so it sits slightly
  // closer to the defender than dead centre in the empty square between the
  // two pieces (story.md amendment 7). Figures 3 and 4 (the "stub" profile)
  // are not offset: only the combat arrows get this treatment. The offset is
  // capped so the arrow's tip never leaves the empty square it is centred
  // on - that square extends 0.5 cell units either side of its own centre,
  // which is `midpointX`/`midpointY` before any nudge - the constraint that
  // outranks the offset itself.
  const halfLength = length / 2;
  const maxForwardOffset = isAdjacentAttack ? 0 : Math.max(0.5 - halfLength, 0);
  const forwardOffset = isAdjacentAttack
    ? 0
    : Math.min(COMBAT_ARROW_FORWARD_OFFSET, maxForwardOffset);
  const centerX = midpointX + unitX * forwardOffset;
  const centerY = midpointY + unitY * forwardOffset;

  // The arrow is centred on that (possibly nudged) point and extends
  // `length` cell units either side of it, so it stops short of both pieces
  // rather than reaching either one.
  const tipX = centerX + unitX * halfLength;
  const tipY = centerY + unitY * halfLength;
  const tailX = centerX - unitX * halfLength;
  const tailY = centerY - unitY * halfLength;
  const headLength = length * HEAD_LENGTH_FRACTION;
  const baseX = tipX - unitX * headLength;
  const baseY = tipY - unitY * headLength;
  const perpX = -unitY;
  const perpY = unitX;
  const halfWidth = headWidth / 2;
  const headPoints = [
    `${String(tipX)},${String(tipY)}`,
    `${String(baseX + perpX * halfWidth)},${String(baseY + perpY * halfWidth)}`,
    `${String(baseX - perpX * halfWidth)},${String(baseY - perpY * halfWidth)}`,
  ].join(" ");

  return (
    <svg
      className="rule-figure__markers"
      viewBox={viewBox}
      preserveAspectRatio="none"
    >
      {/* The shaft stops at the arrowhead's base rather than running the
          full distance to `to`, so the two never overdraw each other. The
          head's own tip stops short of the target square's centre (see the
          sizing comment above) - the arrow points at the defender without
          touching, reaching or overlapping either piece (Decision 1,
          Decision 2, story.md amendment 7). */}
      <line
        className="rule-figure__attack-shaft"
        x1={tailX}
        y1={tailY}
        x2={baseX}
        y2={baseY}
        style={{ strokeWidth: shaftWidth }}
      />
      <polygon className="rule-figure__attack-head" points={headPoints} />
    </svg>
  );
}

/** How far the removal X's strokes are bounded, in the piece icon's own 0-1 fraction of the cell (Decision 2, amendment 4). */
const REMOVAL_X_TOP = 0.4;
const REMOVAL_X_BOTTOM = 0.92;
const REMOVAL_X_LEFT = 0.14;
const REMOVAL_X_RIGHT = 0.86;

/**
 * The black X drawn over a removed piece, with a `--parchment` halo under
 * each stroke. Bounded to roughly the lower two-thirds of the cell
 * (`REMOVAL_X_TOP` clears `PieceIcon`'s top-left corner rank numeral, whose
 * glyph - `x: 0-15, y: 0-17` in a 64x64 `viewBox`, right-anchored - never
 * reaches past about a quarter of the cell's height). Rendered as a sibling
 * *after* the (possibly dimmed) `PieceIcon`, so it is never itself dimmed
 * and always paints on top of both the piece and the arrowhead beneath it.
 */
function RemovalMark() {
  return (
    <svg
      className="rule-figure__removal"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      <line
        className="rule-figure__removal-halo"
        x1={REMOVAL_X_LEFT}
        y1={REMOVAL_X_TOP}
        x2={REMOVAL_X_RIGHT}
        y2={REMOVAL_X_BOTTOM}
      />
      <line
        className="rule-figure__removal-halo"
        x1={REMOVAL_X_RIGHT}
        y1={REMOVAL_X_TOP}
        x2={REMOVAL_X_LEFT}
        y2={REMOVAL_X_BOTTOM}
      />
      <line
        className="rule-figure__removal-mark"
        x1={REMOVAL_X_LEFT}
        y1={REMOVAL_X_TOP}
        x2={REMOVAL_X_RIGHT}
        y2={REMOVAL_X_BOTTOM}
      />
      <line
        className="rule-figure__removal-mark"
        x1={REMOVAL_X_RIGHT}
        y1={REMOVAL_X_TOP}
        x2={REMOVAL_X_LEFT}
        y2={REMOVAL_X_BOTTOM}
      />
    </svg>
  );
}
