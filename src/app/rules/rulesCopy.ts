// The "How to play" page's entire text (story 00000032), declared as plain
// data - no React, no JSX, no CSS - transcribed exactly from story.md's "The
// page's content", which is the copy of record. Nothing here re-words,
// re-punctuates or "fixes" that copy; the four corrections story.md lists
// under "Copy" are already folded into the sentences below.
//
// This module exists for the same reason `figures.ts` does (see that
// module's header): the repository's Vitest environment has no DOM, so
// anything that *can* be pure data is pulled out of the `.tsx` layer and
// checked with plain assertions in `rulesCopy.test.ts`. `RulesScreen.tsx` is
// the thin renderer that reads this module and `figures.ts` to draw the
// page; `RuleFigure.tsx` reads the ten captions specifically. Nothing here
// knows about pixels, SVG or React.

import type { FigureId } from "./figures.ts";

/** The page's full-width header: a title and two lines beneath it. */
export const RULES_HEADER: {
  readonly title: string;
  readonly lines: readonly [string, string];
} = {
  title: "Capture the Flag: Rules",
  lines: [
    "Capture the opponent's flag before they capture yours",
    "Place your pieces in phase one — battle your opponent in phase two",
  ],
};

/** Which side of the two-column layout a section belongs to (Decision 8). */
export type RulesSectionColumn = "left" | "right";

/** Stable ids for the six sections, in the order they appear on the page. */
export type RulesSectionId =
  | "movement"
  | "slowedMovement"
  | "movementForAttacks"
  | "combat"
  | "equalRankAndTower"
  | "rankUp";

/**
 * One of the page's six sections: a heading, a body sentence, which column
 * it sits in, and the ids of the figures (from `figures.ts`) it carries.
 */
export interface RulesSection {
  readonly id: RulesSectionId;
  readonly column: RulesSectionColumn;
  readonly heading: string;
  readonly body: string;
  readonly figureIds: readonly FigureId[];
}

/**
 * The six sections, in page order: the three movement sections (left
 * column) followed by the three combat sections (right column). This is the
 * DOM order Decision 8 requires - left-column sections precede right-column
 * sections regardless of layout.
 */
export const RULES_SECTIONS: readonly RulesSection[] = [
  {
    id: "movement",
    column: "left",
    heading: "Movement",
    body: "Pieces may move up to two squares in any of the four cardinal directions.",
    figureIds: ["movement"],
  },
  {
    id: "slowedMovement",
    column: "left",
    heading: "Slowed movement",
    body: "Pieces may only move one square if any enemy (including Tower or Flag) is present in the immediate surrounding eight squares.",
    figureIds: ["slowedMovement"],
  },
  {
    id: "movementForAttacks",
    column: "left",
    heading: "Movement for attacks",
    body: "Pieces can attack other pieces with the same movements as regular movement, as well as on the immediate diagonal.",
    figureIds: ["attackOrthogonal", "attackDiagonal"],
  },
  {
    id: "combat",
    column: "right",
    heading: "Combat",
    body: "In combat, the stronger piece wins, regardless of which piece attacks which. The losing piece is removed from the board; in the case of an attacker win, the attacker moves to the destination square.",
    figureIds: ["combatRank1Wins", "combatRank3Loses"],
  },
  {
    id: "equalRankAndTower",
    column: "right",
    heading: "Equal-ranked pieces and Tower attacks",
    body: "If a piece attacks another piece of equal rank, both are removed. This also occurs when attacking a Tower.",
    figureIds: ["combatEqualRank", "combatTower"],
  },
  {
    id: "rankUp",
    column: "right",
    heading: "Rank-up",
    body: "If a piece has a friendly piece of identical rank in any of the eight squares immediately surrounding it, it will draw against a piece one rank higher, both when attacking and when defending.",
    figureIds: ["combatRankUpAttack", "combatRankUpDefend"],
  },
];

/**
 * The ten figure captions (implementation plan, Decision 3), keyed by the
 * figure ids `figures.ts` declares. Each is one visible sentence naming the
 * sides by colour and stating exactly what the picture shows - the caption
 * is the whole of a figure's accessible text (the picture itself is
 * `aria-hidden`).
 */
export const RULES_CAPTIONS: Readonly<Record<FigureId, string>> = {
  movement: "Red's piece can move to any of the eight ringed squares.",
  slowedMovement:
    "With a blue piece diagonally beside it, red can reach only four squares.",
  attackOrthogonal: "Red can attack the blue piece one square ahead.",
  attackDiagonal: "Red can attack the blue piece diagonally beside it.",
  combatRank1Wins:
    "Red's rank 1 — the strongest rank — attacks blue's rank 2: the blue piece is removed.",
  combatRank3Loses:
    "Red's rank 3 attacks blue's rank 2: the red piece is removed.",
  combatEqualRank: "Red's rank 4 attacks blue's rank 4: both are removed.",
  combatTower: "Red's rank 4 attacks a blue Tower: both are removed.",
  combatRankUpAttack:
    "Red's rank 3, with a red rank 3 beside it, attacks blue's rank 2: the attacker and the defender are both removed.",
  combatRankUpDefend:
    "Blue's rank 2 attacks a red rank 3 with another red rank 3 right behind it: the attacker and the defender are both removed.",
};

/** The "How to play" start-screen button's fixed copy. */
export const HOW_TO_PLAY_BUTTON: {
  readonly title: string;
  readonly detail: string;
} = {
  title: "How to play",
  detail: "A quick guide to how the game works",
};
