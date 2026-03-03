/**
 * Salt & Pepper – Pure Game Logic (no DOM)
 * -----------------------------------------
 * Designed to be fully testable under Jest and usable in the browser.
 *
 * Data structures
 * ───────────────
 * Pawn   = { player: 1|2, power: Number, isProtector: Boolean, id: String }
 * Board  = 2‑D array  board[row][col]  →  Pawn | null
 * State  = { board, currentPlayer, protectors: {1: count, 2: count},
 *            pieceCounts: {1: n, 2: n}, winner: null|1|2, turnNumber }
 */

// ── Import config (Node vs browser) ────────────────────────
const _cfg = (typeof require !== 'undefined')
  ? require('./gameConfig')
  : globalThis.GameConfig;

/* ============================================================
   Helper utilities
   ============================================================ */

let _nextId = 1;
function _makeId () { return 'p' + (_nextId++); }
function resetIdCounter () { _nextId = 1; }

function createPawn (player, power, isProtector = false) {
  return { player, power, isProtector, id: _makeId() };
}

function clonePawn (p) {
  if (!p) return null;
  return { ...p };
}

function cloneBoard (board) {
  return board.map(row => row.map(cell => clonePawn(cell)));
}

function inBounds (r, c) {
  return r >= 0 && r < _cfg.BOARD_HEIGHT && c >= 0 && c < _cfg.BOARD_WIDTH;
}

/* ============================================================
   Initial state
   ============================================================ */

function createInitialState () {
  resetIdCounter();
  const board = [];
  for (let r = 0; r < _cfg.BOARD_HEIGHT; r++) {
    const row = [];
    for (let c = 0; c < _cfg.BOARD_WIDTH; c++) {
      row.push(null);
    }
    board.push(row);
  }

  // Player 1 (Salt) – top row
  const p1Row = _cfg.PLAYER_1_START_ROW;                    // 0
  for (let c = 0; c < _cfg.STARTING_PIECES_COUNT; c++) {
    board[p1Row][c] = createPawn(_cfg.PLAYER_1, _cfg.STARTING_POWER);
  }

  // Player 2 (Pepper) – bottom row
  const p2Row = _cfg.BOARD_HEIGHT - 1;
  for (let c = 0; c < _cfg.STARTING_PIECES_COUNT; c++) {
    board[p2Row][c] = createPawn(_cfg.PLAYER_2, _cfg.STARTING_POWER);
  }

  return {
    board,
    currentPlayer: _cfg.PLAYER_1,
    protectors: { [_cfg.PLAYER_1]: 0, [_cfg.PLAYER_2]: 0 },
    pieceCounts: {
      [_cfg.PLAYER_1]: _cfg.STARTING_PIECES_COUNT,
      [_cfg.PLAYER_2]: _cfg.STARTING_PIECES_COUNT,
    },
    winner: null,
    turnNumber: 1,
  };
}

/* ============================================================
   Promotion row helpers
   ============================================================ */

/** The row a player's pawn must reach to be promoted. */
function promotionRow (player) {
  // Player 1 starts at top → promotes at bottom (opponent start row)
  // Player 2 starts at bottom → promotes at top
  if (player === _cfg.PLAYER_1) return _cfg.BOARD_HEIGHT - 1;
  return _cfg.PLAYER_1_START_ROW;   // 0
}

/* ============================================================
   Move validation
   ============================================================ */

/**
 * Returns { valid, reason, type }
 * type ∈ 'move' | 'merge' | 'capture'
 */
function validateMove (state, fromR, fromC, toR, toC) {
  const { board, currentPlayer } = state;

  // 1. Bounds
  if (!inBounds(fromR, fromC) || !inBounds(toR, toC)) {
    return { valid: false, reason: 'Out of bounds' };
  }

  // 2. Source must be own pawn
  const src = board[fromR][fromC];
  if (!src || src.player !== currentPlayer) {
    return { valid: false, reason: 'No friendly pawn at source' };
  }

  // 3. Direction check – must match one of MOVE_VECTORS with magnitude 1
  const dr = toR - fromR;
  const dc = toC - fromC;
  const isLegalDirection = _cfg.MOVE_VECTORS.some(v => v.dr === dr && v.dc === dc);
  if (!isLegalDirection) {
    return { valid: false, reason: 'Illegal direction or distance' };
  }

  const dst = board[toR][toC];

  // 4a. Empty square → simple move
  if (!dst) {
    return { valid: true, type: 'move' };
  }

  // 4b. Friendly piece → merge
  if (dst.player === currentPlayer) {
    const mergedPower = src.power + dst.power;
    if (mergedPower > _cfg.MAX_POWER_LEVEL) {
      return { valid: false, reason: `Merge would exceed max power (${_cfg.MAX_POWER_LEVEL})` };
    }
    return { valid: true, type: 'merge' };
  }

  // 4c. Enemy piece → capture
  if (dst.isProtector) {
    // Strict greater required
    if (src.power > dst.power) {
      return { valid: true, type: 'capture' };
    }
    return { valid: false, reason: 'Cannot capture Protector (need strictly greater power)' };
  } else {
    // Greater‑or‑equal
    if (src.power >= dst.power) {
      return { valid: true, type: 'capture' };
    }
    return { valid: false, reason: 'Attacking power too low' };
  }
}

/* ============================================================
   Execute move (returns NEW state – immutable‑style)
   ============================================================ */

function executeMove (state, fromR, fromC, toR, toC) {
  const check = validateMove(state, fromR, fromC, toR, toC);
  if (!check.valid) {
    return { success: false, reason: check.reason, state };
  }

  // Deep‑clone the state so callers keep the old one
  const newBoard = cloneBoard(state.board);
  const newState = {
    ...state,
    board: newBoard,
    protectors: { ...state.protectors },
    pieceCounts: { ...state.pieceCounts },
  };

  const movingPawn = { ...newBoard[fromR][fromC] };

  if (check.type === 'merge') {
    const target = newBoard[toR][toC];
    movingPawn.power = movingPawn.power + target.power;
    // If either pawn was a protector, merged pawn keeps protector status
    if (target.isProtector) movingPawn.isProtector = true;
    // Merging removes one piece from the count (two become one)
    newState.pieceCounts[movingPawn.player] -= 1;
  }

  if (check.type === 'capture') {
    const captured = newBoard[toR][toC];
    newState.pieceCounts[captured.player] -= 1;
    if (captured.isProtector) {
      newState.protectors[captured.player] -= 1;
    }
  }

  // Promotion
  if (toR === promotionRow(movingPawn.player) && movingPawn.power < _cfg.PROMOTION_VALUE) {
    movingPawn.power = _cfg.PROMOTION_VALUE;
  }

  // Place the pawn
  newBoard[fromR][fromC] = null;
  newBoard[toR][toC] = movingPawn;

  // Check win condition – opponent has 0 pieces
  const opponent = movingPawn.player === _cfg.PLAYER_1 ? _cfg.PLAYER_2 : _cfg.PLAYER_1;
  if (newState.pieceCounts[opponent] <= 0) {
    newState.winner = movingPawn.player;
  }

  // Switch turn
  newState.currentPlayer = opponent;
  newState.turnNumber = state.turnNumber + 1;

  return { success: true, type: check.type, state: newState };
}

/* ============================================================
   Protector assignment
   ============================================================ */

function setProtector (state, row, col) {
  const { board, currentPlayer } = state;

  if (!inBounds(row, col)) {
    return { success: false, reason: 'Out of bounds' };
  }
  const pawn = board[row][col];
  if (!pawn || pawn.player !== currentPlayer) {
    return { success: false, reason: 'No friendly pawn at that position' };
  }
  if (pawn.isProtector) {
    return { success: false, reason: 'Pawn is already a Protector' };
  }
  if (state.protectors[currentPlayer] >= _cfg.MAX_PROTECTORS_PER_PLAYER) {
    return { success: false, reason: 'Maximum protectors already assigned' };
  }

  const newBoard = cloneBoard(board);
  newBoard[row][col] = { ...newBoard[row][col], isProtector: true };

  const newState = {
    ...state,
    board: newBoard,
    protectors: { ...state.protectors, [currentPlayer]: state.protectors[currentPlayer] + 1 },
  };

  return { success: true, state: newState };
}

/* ============================================================
   Utility: list all valid moves for current player
   ============================================================ */

function getValidMoves (state) {
  const moves = [];
  const { board, currentPlayer } = state;
  for (let r = 0; r < _cfg.BOARD_HEIGHT; r++) {
    for (let c = 0; c < _cfg.BOARD_WIDTH; c++) {
      const p = board[r][c];
      if (!p || p.player !== currentPlayer) continue;
      for (const v of _cfg.MOVE_VECTORS) {
        const nr = r + v.dr;
        const nc = c + v.dc;
        const check = validateMove(state, r, c, nr, nc);
        if (check.valid) {
          moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, type: check.type });
        }
      }
    }
  }
  return moves;
}

/**
 * Check if current player has any valid move.
 * If not, the game could be declared a draw or loss (depending on house rules).
 */
function hasValidMove (state) {
  return getValidMoves(state).length > 0;
}

/* ============================================================
   Exports
   ============================================================ */

const GameLogic = {
  createInitialState,
  validateMove,
  executeMove,
  setProtector,
  getValidMoves,
  hasValidMove,
  promotionRow,
  inBounds,
  createPawn,
  cloneBoard,
  resetIdCounter,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameLogic;
} else {
  globalThis.GameLogic = GameLogic;
}
