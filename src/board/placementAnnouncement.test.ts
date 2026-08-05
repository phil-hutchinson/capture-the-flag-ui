import { describe, expect, it } from "vitest";
import type { Square } from "../rules/primary/v2/board.ts";
import type { PlacementProgress } from "../rules/primary/v2/placement.ts";
import {
  describeAutoFillCompleted,
  describeBoardCleared,
  describeHandOff,
  describePiecePickedUp,
  describePiecePlaced,
  describePieceMoved,
  describePiecesSwapped,
  describePlacementComplete,
  describeReturnedToTray,
  describeTrayDeselected,
  describeTraySelected,
  placementSquareLabel,
  trayEntryLabel,
} from "./placementAnnouncement.ts";

const A3: Square = { column: "A", row: 3 };
const D3: Square = { column: "D", row: 3 };
const H1: Square = { column: "H", row: 1 };

const NONE_PLACED: PlacementProgress = { placed: 0, total: 25 };
const ONE_PLACED: PlacementProgress = { placed: 1, total: 25 };
const SEVERAL_PLACED: PlacementProgress = { placed: 12, total: 25 };

describe("placementSquareLabel", () => {
  it("names an empty home square", () => {
    const label = placementSquareLabel({
      square: A3,
      band: "home",
      lake: false,
      side: "white",
      selected: false,
      closedToTowers: false,
    });
    expect(label).toBe("A3, empty");
  });

  it("names an occupied home square for the white (Red) side", () => {
    const label = placementSquareLabel({
      square: A3,
      band: "home",
      lake: false,
      pieceType: "champion",
      side: "white",
      selected: false,
      closedToTowers: false,
    });
    expect(label).toBe("A3, Red Champion");
  });

  it("names an occupied home square for the black (Blue) side", () => {
    const label = placementSquareLabel({
      square: A3,
      band: "home",
      lake: false,
      pieceType: "champion",
      side: "black",
      selected: false,
      closedToTowers: false,
    });
    expect(label).toBe("A3, Blue Champion");
  });

  it("marks the currently selected square", () => {
    const label = placementSquareLabel({
      square: A3,
      band: "home",
      lake: false,
      pieceType: "knight",
      side: "white",
      selected: true,
      closedToTowers: false,
    });
    expect(label).toBe("A3, Red Knight, selected");
  });

  it("appends a closed-to-Towers suffix to an empty square's label", () => {
    const label = placementSquareLabel({
      square: A3,
      band: "home",
      lake: false,
      side: "white",
      selected: false,
      closedToTowers: true,
    });
    expect(label).toBe("A3, empty, closed to Towers");
  });

  it("appends a closed-to-Towers suffix to an occupied square's label", () => {
    const label = placementSquareLabel({
      square: A3,
      band: "home",
      lake: false,
      pieceType: "tower",
      side: "white",
      selected: false,
      closedToTowers: true,
    });
    expect(label).toBe("A3, Red Tower, closed to Towers");
  });

  it("names a lake square as outside the placement area", () => {
    const label = placementSquareLabel({
      square: D3,
      band: "lake-row",
      lake: true,
      side: "white",
      selected: false,
      closedToTowers: false,
    });
    expect(label).toBe("D3, lake, outside your placement area");
  });

  it("distinguishes a non-lake square in the lake band from a lake square", () => {
    const label = placementSquareLabel({
      square: H1,
      band: "lake-row",
      lake: false,
      side: "white",
      selected: false,
      closedToTowers: false,
    });
    expect(label).toBe("H1, outside your placement area");
  });

  it("names a buffer-band square (Battle only) as outside the placement area", () => {
    const label = placementSquareLabel({
      square: D3,
      band: "buffer",
      lake: false,
      side: "black",
      selected: false,
      closedToTowers: false,
    });
    expect(label).toBe("D3, outside your placement area");
  });
});

describe("trayEntryLabel", () => {
  it("reads several remaining as a count of pieces", () => {
    expect(trayEntryLabel("footSoldier", 6)).toBe(
      "Foot Soldier, 6 pieces left",
    );
  });

  it("reads exactly one remaining in the singular", () => {
    expect(trayEntryLabel("flag", 1)).toBe("Flag, 1 piece left");
  });

  it("reads none remaining unambiguously, not as a bare zero", () => {
    expect(trayEntryLabel("tower", 0)).toBe("Tower, no pieces left");
  });
});

describe("placement event sentences", () => {
  it("announces a tray type selected", () => {
    expect(describeTraySelected("halberdier", "white")).toBe(
      "Red Halberdier selected.",
    );
  });

  it("announces a tray type deselected", () => {
    expect(describeTrayDeselected("halberdier", "black")).toBe(
      "Blue Halberdier deselected.",
    );
  });

  it("announces a piece placed, carrying singular progress", () => {
    expect(describePiecePlaced("militia", "white", A3, ONE_PLACED)).toBe(
      "Red Militia placed on A3. 1 of 25 placed.",
    );
  });

  it("announces a piece placed, carrying plural progress", () => {
    expect(describePiecePlaced("militia", "black", A3, SEVERAL_PLACED)).toBe(
      "Blue Militia placed on A3. 12 of 25 placed.",
    );
  });

  it("announces a placed piece picked up, with no progress clause", () => {
    expect(describePiecePickedUp("masterOfArms", "white", A3)).toBe(
      "Red Master-of-Arms picked up from A3.",
    );
  });

  it("announces a piece moved, with no progress clause", () => {
    expect(describePieceMoved("masterOfArms", "black", D3)).toBe(
      "Blue Master-of-Arms moved to D3.",
    );
  });

  it("announces two pieces swapped, naming the side once", () => {
    expect(describePiecesSwapped("knight", A3, "champion", D3, "white")).toBe(
      "Red Knight and Champion swapped places between A3 and D3.",
    );
  });

  it("announces a piece returned to the tray, carrying progress", () => {
    expect(
      describeReturnedToTray("footSoldier", "white", A3, SEVERAL_PLACED),
    ).toBe("Red Foot Soldier returned to the tray from A3. 12 of 25 placed.");
  });

  it("announces the board cleared, carrying zero progress", () => {
    expect(describeBoardCleared(NONE_PLACED)).toBe(
      "Board cleared. 0 of 25 placed.",
    );
  });

  it("announces Auto-fill completing, carrying progress", () => {
    const complete: PlacementProgress = { placed: 25, total: 25 };
    expect(describeAutoFillCompleted(complete)).toBe(
      "Auto-fill complete. 25 of 25 placed.",
    );
  });

  it("announces the hand-off naming the incoming white (Red) player", () => {
    expect(describeHandOff("white", NONE_PLACED)).toBe(
      "Red's turn to place their army. 0 of 25 placed.",
    );
  });

  it("announces the hand-off naming the incoming black (Blue) player", () => {
    expect(describeHandOff("black", NONE_PLACED)).toBe(
      "Blue's turn to place their army. 0 of 25 placed.",
    );
  });

  it("announces both armies placed and white (Red) to move", () => {
    expect(describePlacementComplete("white")).toBe(
      "Both armies are placed. Red to move.",
    );
  });

  it("announces both armies placed and black (Blue) to move", () => {
    expect(describePlacementComplete("black")).toBe(
      "Both armies are placed. Blue to move.",
    );
  });

  it("never says 'ply' anywhere in these sentences", () => {
    const sentences = [
      describeTraySelected("champion", "white"),
      describeTrayDeselected("champion", "black"),
      describePiecePlaced("champion", "white", A3, ONE_PLACED),
      describePiecePickedUp("champion", "white", A3),
      describePieceMoved("champion", "white", A3),
      describePiecesSwapped("champion", A3, "knight", D3, "white"),
      describeReturnedToTray("champion", "white", A3, SEVERAL_PLACED),
      describeBoardCleared(NONE_PLACED),
      describeAutoFillCompleted(SEVERAL_PLACED),
      describeHandOff("white", NONE_PLACED),
      describePlacementComplete("white"),
    ];
    for (const sentence of sentences) {
      expect(sentence.toLowerCase()).not.toContain("ply");
    }
  });
});
