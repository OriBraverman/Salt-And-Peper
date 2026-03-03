/**
 * Salt & Pepper – Centralised Game Configuration
 * ------------------------------------------------
 * Every "magic number" lives here so the rules can be tweaked in one place.
 * When running inside Node (Jest tests) we export via module.exports;
 * in the browser we attach to globalThis.GameConfig.
 */

const GameConfig = Object.freeze({

  /* ── Board ─────────────────────────────────────────────── */
  BOARD_WIDTH:  4,   // columns
  BOARD_HEIGHT: 5,   // rows

  /* ── Pieces ────────────────────────────────────────────── */
  STARTING_PIECES_COUNT: 4,   // pawns per player at start
  STARTING_POWER:        1,   // initial power level of every pawn
  MAX_POWER_LEVEL:       2,   // highest power a pawn can reach
  PROMOTION_VALUE:       2,   // power level granted on promotion

  /* ── Movement vectors (row‑delta, col‑delta) ──────────── */
  // Orthogonal only by default; add {dr:1,dc:1} etc. for diagonals.
  MOVE_VECTORS: Object.freeze([
    { dr: -1, dc:  0 },  // up
    { dr:  1, dc:  0 },  // down
    { dr:  0, dc: -1 },  // left
    { dr:  0, dc:  1 },  // right
  ]),

  /* ── Players ───────────────────────────────────────────── */
  PLAYER_1: 1,
  PLAYER_2: 2,
  PLAYER_1_NAME: 'Salt',
  PLAYER_2_NAME: 'Pepper',

  /* Player 1 (Salt) starts on row 0 (top).
     Player 2 (Pepper) starts on row BOARD_HEIGHT - 1 (bottom). */
  PLAYER_1_START_ROW: 0,
  // PLAYER_2_START_ROW is derived: BOARD_HEIGHT - 1

  /* ── Capture rules ─────────────────────────────────────── */
  // Standard capture:   attacker >= defender
  // Protector capture:  attacker >  defender  (ties fail)

  /* ── Merging ───────────────────────────────────────────── */
  // Only two pawns of power 1 can merge (1+1 = 2).
  // Merged result must not exceed MAX_POWER_LEVEL.

  /* ── Protector ─────────────────────────────────────────── */
  MAX_PROTECTORS_PER_PLAYER: 1,
});

// ── Export for both Node and browser ────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameConfig;
} else {
  globalThis.GameConfig = GameConfig;
}
