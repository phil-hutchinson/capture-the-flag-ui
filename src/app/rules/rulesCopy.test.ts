// Checks `rulesCopy.ts`'s structure and vocabulary (story 00000032's
// implementation plan, Step 2). This is a guard against a silent edit to
// fixed copy and against the figures/copy drifting apart - it is not a
// transcription check (there is no way to assert "matches story.md" in
// code), so reviewers must still eyeball the copy against story.md at
// Step 4's Gate A and Step 7's Gate B.

import { describe, expect, it } from "vitest";
import { FIGURES, type FigureId } from "./figures.ts";
import {
  RULES_CAPTIONS,
  RULES_HEADER,
  RULES_SECTIONS,
  type RulesSectionId,
} from "./rulesCopy.ts";

const EXPECTED_HEADER_TITLE = "Capture the Flag: Rules";
const EXPECTED_HEADER_LINES: readonly [string, string] = [
  "Capture the opponent's flag before they capture yours",
  "Place your pieces in phase one — battle your opponent in phase two",
];

const EXPECTED_HEADINGS_IN_ORDER: readonly string[] = [
  "Movement",
  "Slowed movement",
  "Movement for attacks",
  "Combat",
  "Equal-ranked pieces and Tower attacks",
  "Rank-up",
];

/** The six sections' fixed body sentences, in the same order as `RULES_SECTIONS`. */
const EXPECTED_BODIES_IN_ORDER: readonly string[] = [
  "Pieces may move up to two squares in any of the four cardinal directions.",
  "Pieces may only move one square if any enemy (including Tower or Flag) is present in the immediate surrounding eight squares.",
  "Pieces can attack other pieces with the same movements as regular movement, as well as on the immediate diagonal.",
  "In combat, the stronger piece wins, regardless of which piece attacks which. The losing piece is removed from the board; in the case of an attacker win, the attacker moves to the destination square.",
  "If a piece attacks another piece of equal rank, both are removed. This also occurs when attacking a Tower.",
  "If a piece has a friendly piece of identical rank in any of the eight squares immediately surrounding it, it will draw against a piece one rank higher, both when attacking and when defending.",
];

/** Which figure ids each section is fixed to carry (implementation plan, Decision 7). */
const EXPECTED_FIGURE_IDS_BY_SECTION: Readonly<
  Record<RulesSectionId, readonly FigureId[]>
> = {
  movement: ["movement"],
  slowedMovement: ["slowedMovement"],
  movementForAttacks: ["attackOrthogonal", "attackDiagonal"],
  combat: ["combatRank1Wins", "combatRank3Loses"],
  equalRankAndTower: ["combatEqualRank", "combatTower"],
  rankUp: ["combatRankUpAttack", "combatRankUpDefend"],
};

describe("the six sections", () => {
  it("are exactly six, in the fixed order, with the fixed headings", () => {
    expect(RULES_SECTIONS).toHaveLength(6);
    expect(RULES_SECTIONS.map((section) => section.heading)).toEqual(
      EXPECTED_HEADINGS_IN_ORDER,
    );
  });

  it("has the fixed header lines and each section's fixed body sentence", () => {
    expect(RULES_HEADER.title).toBe(EXPECTED_HEADER_TITLE);
    expect(RULES_HEADER.lines).toEqual(EXPECTED_HEADER_LINES);
    expect(RULES_SECTIONS.map((section) => section.body)).toEqual(
      EXPECTED_BODIES_IN_ORDER,
    );
  });

  it("has no duplicate section ids", () => {
    const ids = RULES_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts exactly three sections in each column, movement before combat", () => {
    const columns = RULES_SECTIONS.map((section) => section.column);
    expect(columns.filter((column) => column === "left")).toHaveLength(3);
    expect(columns.filter((column) => column === "right")).toHaveLength(3);
    // The three left-column sections come first in the array (DOM order).
    expect(columns).toEqual([
      "left",
      "left",
      "left",
      "right",
      "right",
      "right",
    ]);
  });
});

describe("figure coverage", () => {
  const allFigureIds: readonly FigureId[] = FIGURES.map((figure) => figure.id);

  it("names every figure id exactly once across the sections' figure lists, with none left over", () => {
    const namedIds = RULES_SECTIONS.flatMap((section) => section.figureIds);
    expect(namedIds.sort()).toEqual([...allFigureIds].sort());
    expect(new Set(namedIds).size).toBe(namedIds.length);
  });

  it("gives every section a non-empty figure list", () => {
    for (const section of RULES_SECTIONS) {
      expect(section.figureIds.length).toBeGreaterThan(0);
    }
  });

  it("assigns each section exactly its fixed figure ids", () => {
    for (const section of RULES_SECTIONS) {
      expect(section.figureIds).toEqual(
        EXPECTED_FIGURE_IDS_BY_SECTION[section.id],
      );
    }
  });

  it("gives every figure id exactly one caption, and no caption for anything else", () => {
    const captionIds = Object.keys(RULES_CAPTIONS) as FigureId[];
    expect(captionIds.sort()).toEqual([...allFigureIds].sort());
    for (const id of allFigureIds) {
      expect(typeof RULES_CAPTIONS[id]).toBe("string");
      expect(RULES_CAPTIONS[id].length).toBeGreaterThan(0);
    }
  });
});

/** Every string of visible copy on the page - header, sections, captions. */
function allCopyStrings(): string[] {
  const strings: string[] = [RULES_HEADER.title, ...RULES_HEADER.lines];
  for (const section of RULES_SECTIONS) {
    strings.push(section.heading, section.body);
  }
  strings.push(...Object.values(RULES_CAPTIONS));
  return strings;
}

describe("vocabulary guards", () => {
  it('never says "ply"', () => {
    for (const text of allCopyStrings()) {
      expect(text.toLowerCase()).not.toMatch(/\bply\b/);
    }
  });

  it('never says "orthogonal" (the page says "cardinal directions")', () => {
    for (const text of allCopyStrings()) {
      expect(text.toLowerCase()).not.toContain("orthogonal");
    }
  });

  it('capitalises "Tower" and "Flag" wherever they name the pieces', () => {
    // The header's second line - "Capture the opponent's flag before they
    // capture yours" - is fixed copy transcribed verbatim from story.md and
    // deliberately keeps a lower-case "flag" (the idiom, not a naming of the
    // piece); story.md's corrections only capitalise "Tower"/"Flag" in the
    // equal-rank section and its heading. So this guard covers the sections
    // and captions, where the piece names actually appear, not the header.
    const sectionAndCaptionText = [
      ...RULES_SECTIONS.flatMap((section) => [section.heading, section.body]),
      ...Object.values(RULES_CAPTIONS),
    ];
    for (const text of sectionAndCaptionText) {
      const towerMatches = text.match(/tower/gi) ?? [];
      for (const match of towerMatches) {
        expect(match).toBe("Tower");
      }
      const flagMatches = text.match(/flag/gi) ?? [];
      for (const match of flagMatches) {
        expect(match).toBe("Flag");
      }
    }
  });

  it("contains no URL, since the page has no outbound link", () => {
    for (const text of allCopyStrings()) {
      expect(text.toLowerCase()).not.toContain("http");
    }
  });
});
