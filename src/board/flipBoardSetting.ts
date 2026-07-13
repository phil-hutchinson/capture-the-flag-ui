// Persistence for the "Flip board between turns" Phase 2 view setting
// (story 00000012). This is a device setting, not part of any game or game
// record: it is read once when the app starts and written whenever the
// player changes the toggle. It has no effect on rules or game state - see
// `viewSide` in `playSession.ts`, the seam that consumes it.
//
// Persistence is best-effort: local storage may be unavailable (blocked by
// the browser) or absent entirely (e.g. the node test environment, which has
// no `localStorage` global at all). In every such case reading falls back to
// the default and writing is a silent no-op - the app must never error out
// over a missing or broken storage.

const STORAGE_KEY = "ctf:flip-board-between-turns";

/** Default value when nothing is stored, or the setting cannot be read: flipping on. */
const DEFAULT_FLIP_BETWEEN_TURNS = true;

/**
 * Reads the persisted "flip board between turns" setting. Returns
 * `DEFAULT_FLIP_BETWEEN_TURNS` if nothing is stored, the stored value isn't
 * a recognizable boolean, or local storage is unavailable.
 */
export function readFlipBetweenTurns(): boolean {
  try {
    if (typeof globalThis.localStorage === "undefined") {
      return DEFAULT_FLIP_BETWEEN_TURNS;
    }
    const stored = globalThis.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return DEFAULT_FLIP_BETWEEN_TURNS;
  } catch {
    return DEFAULT_FLIP_BETWEEN_TURNS;
  }
}

/**
 * Persists the "flip board between turns" setting. Silently does nothing if
 * local storage is unavailable.
 */
export function writeFlipBetweenTurns(flipBetweenTurns: boolean): void {
  try {
    if (typeof globalThis.localStorage === "undefined") {
      return;
    }
    globalThis.localStorage.setItem(STORAGE_KEY, String(flipBetweenTurns));
  } catch {
    // Best-effort: local storage blocked or throwing. Nothing to do.
  }
}
