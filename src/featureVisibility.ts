// Story 00000034's one place to gate a hidden feature back in. Each constant
// below hides one feature that is otherwise fully built and wired: the
// component, screen, routing, props, styles and tests all stay in the tree
// exactly as they are, only the way in is hidden. Flipping a constant to
// `true` is the entire change needed to bring that feature back - no other
// edit, anywhere, is required. This file must never grow logic; it is
// constants only.

/**
 * Shows the "Play against the computer" choice on the start screen. Off
 * because the trained engine has not caught up with the current rules
 * (story 00000023); flip to `true` once it has, to show the choice again,
 * dimmed and unavailable, exactly as before.
 */
export const SHOW_PLAY_AGAINST_THE_COMPUTER: boolean = false;

/**
 * Shows the "Review a game" choice on the start screen. Off because nothing
 * this app produces can be recorded yet, so a first-time viewer has no file
 * to open; flip to `true` to restore the choice and its route to the import
 * screen.
 */
export const SHOW_REVIEW_A_GAME: boolean = false;

/**
 * Shows the "Developer: inspect game record" disclosure at the foot of the
 * game screen. Off because it is not meant for a first-time viewer; flip to
 * `true` to restore the disclosure, unchanged, under both the hot-seat and
 * engine game screens.
 */
export const SHOW_DEVELOPER_GAME_RECORD: boolean = false;
