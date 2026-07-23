// The three difficulty modes for the against-the-computer mode (story
// 00000021, Step 4). This is the single source of truth for each mode's
// iteration budget and derived double cap (story.md's "Three difficulty
// modes, chosen at setup" and fixed decision 4's `2*budget` cap) - the setup
// screen (`EngineSideChoice.tsx`) reads `DIFFICULTY_MODES` to render its
// buttons, and the play loop (Step 5) will read the same table to build the
// `SearchDriverConfig` the worker is initialised with, so the numbers never
// have to be kept in sync between two places.
//
// Only the iteration count varies between modes (story.md's "Iteration count
// is the only difficulty axis this story"); every mode shares the same PUCT
// constants (`DEFAULT_SEARCH_CONFIG`).

import { DEFAULT_SEARCH_CONFIG } from "./search.ts";
import type { SearchDriverConfig } from "./searchDriver.ts";

/** The three difficulty modes a player can choose at setup. */
export type Difficulty = "easy" | "medium" | "hard";

/**
 * One difficulty mode's player-facing label and its search sizing:
 * `budget` is the number of *new* search iterations run each move (story.md's
 * 500 / 2000 / 7500), and `cap` is the double cap on the root's total visit
 * count (fixed decision 4's `2*budget` - 1000 / 4000 / 15000). The iteration
 * numbers themselves are deliberately not shown to the player (fixed decision
 * 7) - only `label` is player-facing.
 */
export interface DifficultyMode {
  readonly id: Difficulty;
  readonly label: string;
  readonly budget: number;
  readonly cap: number;
}

/**
 * The three modes in the order they are offered on the setup screen, plainly
 * labelled per fixed decision 7. `budget`/`cap` per story.md: easy 500/1000,
 * medium 2000/4000, hard 7500/15000.
 */
export const DIFFICULTY_MODES: readonly DifficultyMode[] = [
  { id: "easy", label: "Easy", budget: 500, cap: 1000 },
  { id: "medium", label: "Medium", budget: 2000, cap: 4000 },
  { id: "hard", label: "Hard", budget: 7500, cap: 15000 },
];

/** Medium is preselected on the setup screen (fixed decision 7). */
export const DEFAULT_DIFFICULTY: Difficulty = "medium";

/** The mode matching `difficulty` - always found, since `Difficulty` only ever names one of `DIFFICULTY_MODES`. */
export function difficultyMode(difficulty: Difficulty): DifficultyMode {
  const mode = DIFFICULTY_MODES.find(
    (candidate) => candidate.id === difficulty,
  );
  if (mode === undefined) {
    throw new Error(`difficultyMode: unknown difficulty "${difficulty}".`);
  }
  return mode;
}

/**
 * The `SearchDriverConfig` for `difficulty` - this mode's budget/cap plus the
 * shared PUCT constants - ready for the worker's `init` message (Step 5).
 * Nothing consumes this yet in Step 4; it exists here so both this module and
 * Step 5 agree on how a `Difficulty` becomes a driver config.
 */
export function searchDriverConfigForDifficulty(
  difficulty: Difficulty,
): SearchDriverConfig {
  const mode = difficultyMode(difficulty);
  return { search: DEFAULT_SEARCH_CONFIG, budget: mode.budget, cap: mode.cap };
}
