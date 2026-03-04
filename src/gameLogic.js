/**
 * Salt & Pepper – Pure Game Logic (no DOM)
 * -----------------------------------------
 * Designed to be fully testable under Jest and usable in the browser.
 *
 * Data structures
 * ───────────────
 * Pawn   = { player: 1|2, power: Number, isDefender: Boolean,
 *            promotedParts: Number, id: String }
 *   – power: 1 or 2
 *   – isDefender: true = defender stance (invincible roadblock); false = attacker
 *   – promotedParts:
 *       power‑1 → 0 (unpromoted) or 1 (promoted)
 *       power‑2 → 0 (both unpromoted), 1 (mixed), 2 (both promoted)
 *
 * Board  = 2‑D array  board[row][col]  →  Pawn | null
 * State  = { board, currentPlayer,
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

function createPawn (player, power, isDefender = false, promotedParts = 0) {
  return { player, power, isDefender, promotedParts, id: _makeId() };
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
    pieceCounts: {
      [_cfg.PLAYER_1]: _cfg.STARTING_PIECES_COUNT,
      [_cfg.PLAYER_2]: _cfg.STARTING_PIECES_COUNT,
    },
    winner: null,
    turnNumber: 1,
  };
}

/* ============================================================
   Row helpers
   ============================================================ */

/** The row a player's pawn must reach to be promoted (opponent's starting row). */
function promotionRow (player) {
  if (player === _cfg.PLAYER_1) return _cfg.BOARD_HEIGHT - 1;
  return _cfg.PLAYER_1_START_ROW;   // 0
}

/** The player's own starting row (used for unpromotion). */
function startingRow (player) {
  if (player === _cfg.PLAYER_1) return _cfg.PLAYER_1_START_ROW;   // 0
  return _cfg.BOARD_HEIGHT - 1;
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

  // 2. Source must be own attacker pawn
  const src = board[fromR][fromC];
  if (!src || src.player !== currentPlayer) {
    return { valid: false, reason: 'No friendly pawn at source' };
  }
  if (src.isDefender) {
    return { valid: false, reason: 'Defenders cannot move' };
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

  // 4b. Friendly piece → merge (both must be attackers)
  if (dst.player === currentPlayer) {
    if (dst.isDefender) {
      return { valid: false, reason: 'Cannot move onto a friendly defender' };
    }
    const mergedPower = src.power + dst.power;
    if (mergedPower > _cfg.MAX_POWER_LEVEL) {
      return { valid: false, reason: `Merge would exceed max power (${_cfg.MAX_POWER_LEVEL})` };
    }
    return { valid: true, type: 'merge' };
  }

  // 4c. Enemy piece
  // Defenders are invincible roadblocks
  if (dst.isDefender) {
    return { valid: false, reason: 'Defenders are invincible — cannot capture or move into' };
  }

  // Enemy attacker: need power >= target power
  if (src.power >= dst.power) {
    return { valid: true, type: 'capture' };
  }
  return { valid: false, reason: 'Attacking power too low' };
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
    pieceCounts: { ...state.pieceCounts },
  };

  const movingPawn = { ...newBoard[fromR][fromC] };
  const player = movingPawn.player;
  const opponent = player === _cfg.PLAYER_1 ? _cfg.PLAYER_2 : _cfg.PLAYER_1;
  const promoRow = promotionRow(player);
  const ownRow = startingRow(player);

  if (check.type === 'merge') {
    const target = newBoard[toR][toC];
    // Track promotedParts composition
    movingPawn.promotedParts = movingPawn.promotedParts + target.promotedParts;
    movingPawn.power = movingPawn.power + target.power;
    // Merging removes one piece from the count
    newState.pieceCounts[player] -= 1;
  }

  if (check.type === 'capture') {
    const captured = newBoard[toR][toC];
    newState.pieceCounts[captured.player] -= 1;
  }

  // ── Promotion logic ──────────────────────────────────────
  let leftoverPlaced = false;

  if (toR === promoRow) {
    if (movingPawn.power === 1 && movingPawn.promotedParts === 0) {
      // Unpromoted power‑1 reaches end row → becomes power‑2, fully promoted
      movingPawn.power = _cfg.PROMOTION_VALUE;
      movingPawn.promotedParts = 2;
    } else if (movingPawn.power === 2 && movingPawn.promotedParts < 2) {
      // Power‑2 with at least one unpromoted part reaches end row → split
      // Destination pawn becomes power‑2 fully promoted
      // Origin gets a power‑1 leftover
      const leftoverPromoted = movingPawn.promotedParts; // 0 → leftover unpromoted; 1 → leftover promoted
      const leftover = createPawn(player, 1, false, leftoverPromoted);
      newBoard[fromR][fromC] = leftover;
      newState.pieceCounts[player] += 1; // split creates one extra piece
      leftoverPlaced = true;

      movingPawn.power = _cfg.PROMOTION_VALUE;
      movingPawn.promotedParts = 2;
    }
    // else: fully promoted power‑2 (promotedParts===2) → no special action
  }

  // ── Unpromotion logic ────────────────────────────────────
  // A promoted power‑1 that reaches its own starting row unpromotes
  if (toR === ownRow && movingPawn.power === 1 && movingPawn.promotedParts === 1) {
    movingPawn.promotedParts = 0;
  }

  // Place the pawn
  if (!leftoverPlaced) {
    newBoard[fromR][fromC] = null;
  }
  newBoard[toR][toC] = movingPawn;

  // Check win condition – opponent has 0 pieces
  if (newState.pieceCounts[opponent] <= 0) {
    newState.winner = player;
  }

  // Switch turn
  newState.currentPlayer = opponent;
  newState.turnNumber = state.turnNumber + 1;

  return { success: true, type: check.type, state: newState };
}

/* ============================================================
   Unmerge validation
   ============================================================ */

/**
 * Validate an unmerge action.
 * The source pawn (power-2 attacker) splits. One part stays, one goes to (toR, toC).
 *
 * Returns { valid, reason, targetType }
 * targetType ∈ 'empty' | 'merge' | 'capture'
 */
function validateUnmerge (state, fromR, fromC, toR, toC) {
  const { board, currentPlayer } = state;

  if (!inBounds(fromR, fromC) || !inBounds(toR, toC)) {
    return { valid: false, reason: 'Out of bounds' };
  }

  const src = board[fromR][fromC];
  if (!src || src.player !== currentPlayer) {
    return { valid: false, reason: 'No friendly pawn at source' };
  }
  if (src.isDefender) {
    return { valid: false, reason: 'Defenders cannot unmerge' };
  }
  if (src.power !== _cfg.MAX_POWER_LEVEL) {
    return { valid: false, reason: 'Only power-2 pawns can unmerge' };
  }

  // Direction check
  const dr = toR - fromR;
  const dc = toC - fromC;
  const isLegalDirection = _cfg.MOVE_VECTORS.some(v => v.dr === dr && v.dc === dc);
  if (!isLegalDirection) {
    return { valid: false, reason: 'Illegal direction or distance' };
  }

  const dst = board[toR][toC];
  const player = src.player;
  const promoRow = promotionRow(player);

  // Determine if the placed pawn will promote on the enemy line
  const willPromote = (toR === promoRow && src.promotedParts < 2);

  if (!dst) {
    return { valid: true, targetType: 'empty' };
  }

  if (dst.player === currentPlayer) {
    // Friendly pawn: must be an attacker with power 1 for immediate re-merge
    if (dst.isDefender) {
      return { valid: false, reason: 'Cannot unmerge onto a friendly defender' };
    }
    if (dst.power !== 1) {
      return { valid: false, reason: 'Cannot unmerge onto a friendly pawn with power > 1' };
    }
    // If the split pawn promotes (becomes power-2), it can't merge with the friendly power-1
    if (willPromote) {
      return { valid: false, reason: 'Cannot unmerge-promote onto a friendly pawn (would exceed max power)' };
    }
    return { valid: true, targetType: 'merge' };
  }

  // Enemy pawn
  if (dst.isDefender) {
    return { valid: false, reason: 'Defenders are invincible — cannot unmerge onto' };
  }

  // The split pawn is power-1, so it can only capture enemy attackers of power 1
  // UNLESS it promotes on the enemy line (becoming power-2)
  if (willPromote) {
    // Promoted to power-2: can capture any enemy attacker
    return { valid: true, targetType: 'capture' };
  } else {
    // Normal power-1 split pawn
    if (dst.power <= 1) {
      return { valid: true, targetType: 'capture' };
    }
    return { valid: false, reason: 'Unmerged pawn (power 1) cannot capture enemy with higher power' };
  }
}

/* ============================================================
   Execute unmerge
   ============================================================ */

function executeUnmerge (state, fromR, fromC, toR, toC) {
  const check = validateUnmerge(state, fromR, fromC, toR, toC);
  if (!check.valid) {
    return { success: false, reason: check.reason, state };
  }

  const newBoard = cloneBoard(state.board);
  const newState = {
    ...state,
    board: newBoard,
    pieceCounts: { ...state.pieceCounts },
  };

  const src = newBoard[fromR][fromC];
  const player = src.player;
  const opponent = player === _cfg.PLAYER_1 ? _cfg.PLAYER_2 : _cfg.PLAYER_1;
  const promoRow = promotionRow(player);
  const ownRow = startingRow(player);
  const willPromote = (toR === promoRow && src.promotedParts < 2);

  // Determine the promoted parts of the two resulting pawns
  let stayPromoted, goPromoted;
  if (src.promotedParts === 0) {
    stayPromoted = 0;
    goPromoted = 0;
  } else if (src.promotedParts === 1) {
    // Mixed: staying pawn gets the promoted part, going pawn gets unpromoted
    stayPromoted = 1;
    goPromoted = 0;
  } else {
    // Both promoted
    stayPromoted = 1;
    goPromoted = 1;
  }

  // Create the staying pawn (remains at origin)
  const stayPawn = createPawn(player, 1, false, stayPromoted);

  // Handle unpromotion for staying pawn: if on own starting row and promoted
  if (fromR === ownRow && stayPawn.promotedParts === 1) {
    stayPawn.promotedParts = 0;
  }

  // Create or promote the going pawn
  let goPawn;
  if (willPromote) {
    // Going pawn promotes to power-2 fully promoted
    goPawn = createPawn(player, _cfg.PROMOTION_VALUE, false, 2);
  } else {
    goPawn = createPawn(player, 1, false, goPromoted);
    // Handle unpromotion for going pawn: if landing on own starting row
    if (toR === ownRow && goPawn.promotedParts === 1) {
      goPawn.promotedParts = 0;
    }
  }

  // Splitting increases piece count by 1 (1 pawn → 2 pawns)
  newState.pieceCounts[player] += 1;

  // Handle target interactions
  if (check.targetType === 'capture') {
    const captured = newBoard[toR][toC];
    newState.pieceCounts[captured.player] -= 1;
  }

  if (check.targetType === 'merge') {
    const target = newBoard[toR][toC];
    // Merge the going power-1 with the friendly power-1
    goPawn.power = goPawn.power + target.power; // = 2
    goPawn.promotedParts = goPawn.promotedParts + target.promotedParts;
    // Merge cancels one of the newly created pieces
    newState.pieceCounts[player] -= 1;
  }

  // Place pawns
  newBoard[fromR][fromC] = stayPawn;
  newBoard[toR][toC] = goPawn;

  // Check win condition
  if (newState.pieceCounts[opponent] <= 0) {
    newState.winner = player;
  }

  // Switch turn
  newState.currentPlayer = opponent;
  newState.turnNumber = state.turnNumber + 1;

  return { success: true, type: 'unmerge', state: newState };
}

/* ============================================================
   Defender / Attacker stance actions (each costs one turn)
   ============================================================ */

/**
 * Switch an attacker pawn to defender stance.
 * Only power-1 pawns can become defenders. Costs a turn.
 */
function setDefender (state, row, col) {
  const { board, currentPlayer } = state;

  if (!inBounds(row, col)) {
    return { success: false, reason: 'Out of bounds' };
  }
  const pawn = board[row][col];
  if (!pawn || pawn.player !== currentPlayer) {
    return { success: false, reason: 'No friendly pawn at that position' };
  }
  if (pawn.isDefender) {
    return { success: false, reason: 'Pawn is already a defender' };
  }
  if (pawn.power !== 1) {
    return { success: false, reason: 'Only power-1 pawns can become defenders' };
  }

  const newBoard = cloneBoard(board);
  newBoard[row][col] = { ...newBoard[row][col], isDefender: true };

  const opponent = currentPlayer === _cfg.PLAYER_1 ? _cfg.PLAYER_2 : _cfg.PLAYER_1;
  const newState = {
    ...state,
    board: newBoard,
    pieceCounts: { ...state.pieceCounts },
    currentPlayer: opponent,
    turnNumber: state.turnNumber + 1,
  };

  return { success: true, state: newState };
}

/**
 * Switch a defender pawn back to attacker stance. Costs a turn.
 */
function setAttacker (state, row, col) {
  const { board, currentPlayer } = state;

  if (!inBounds(row, col)) {
    return { success: false, reason: 'Out of bounds' };
  }
  const pawn = board[row][col];
  if (!pawn || pawn.player !== currentPlayer) {
    return { success: false, reason: 'No friendly pawn at that position' };
  }
  if (!pawn.isDefender) {
    return { success: false, reason: 'Pawn is not a defender' };
  }

  const newBoard = cloneBoard(board);
  newBoard[row][col] = { ...newBoard[row][col], isDefender: false };

  const opponent = currentPlayer === _cfg.PLAYER_1 ? _cfg.PLAYER_2 : _cfg.PLAYER_1;
  const newState = {
    ...state,
    board: newBoard,
    pieceCounts: { ...state.pieceCounts },
    currentPlayer: opponent,
    turnNumber: state.turnNumber + 1,
  };

  return { success: true, state: newState };
}

/* ============================================================
   Utility: list all valid actions for current player
   ============================================================ */

function getValidMoves (state) {
  const moves = [];
  const { board, currentPlayer } = state;
  for (let r = 0; r < _cfg.BOARD_HEIGHT; r++) {
    for (let c = 0; c < _cfg.BOARD_WIDTH; c++) {
      const p = board[r][c];
      if (!p || p.player !== currentPlayer) continue;

      // Attacker movement / merge / capture
      if (!p.isDefender) {
        for (const v of _cfg.MOVE_VECTORS) {
          const nr = r + v.dr;
          const nc = c + v.dc;
          const check = validateMove(state, r, c, nr, nc);
          if (check.valid) {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, type: check.type });
          }
        }
      }

      // Unmerge
      if (!p.isDefender && p.power === _cfg.MAX_POWER_LEVEL) {
        for (const v of _cfg.MOVE_VECTORS) {
          const nr = r + v.dr;
          const nc = c + v.dc;
          const check = validateUnmerge(state, r, c, nr, nc);
          if (check.valid) {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, type: 'unmerge' });
          }
        }
      }

      // Become defender (power-1 attacker only)
      if (!p.isDefender && p.power === 1) {
        moves.push({ fromR: r, fromC: c, toR: r, toC: c, type: 'setDefender' });
      }

      // Become attacker (defenders only)
      if (p.isDefender) {
        moves.push({ fromR: r, fromC: c, toR: r, toC: c, type: 'setAttacker' });
      }
    }
  }
  return moves;
}

/**
 * Check if current player has any valid action.
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
  validateUnmerge,
  executeUnmerge,
  setDefender,
  setAttacker,
  getValidMoves,
  hasValidMove,
  promotionRow,
  startingRow,
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
