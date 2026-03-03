/**
 * Salt & Pepper – Comprehensive Unit Tests
 * ------------------------------------------
 * Covers every rule described in README.md:
 *   a) Orthogonal‑only, 1‑step movement
 *   b) Merging limits (1+1=2 ✓ ; 1+2 ✗ ; 2+2 ✗)
 *   c) Standard eating (attacker >= defender)
 *   d) Protector eating (attacker > defender; ties fail)
 *   e) Promotion on reaching opponent's starting row
 */

const GameLogic = require('../src/gameLogic');
const GameConfig = require('../src/gameConfig');

/* ── helpers ────────────────────────────────────────────── */

/** Quickly place pawns on a blank board and return a state object. */
function buildState (placements, currentPlayer = GameConfig.PLAYER_1) {
  GameLogic.resetIdCounter();
  const board = [];
  for (let r = 0; r < GameConfig.BOARD_HEIGHT; r++) {
    board.push(new Array(GameConfig.BOARD_WIDTH).fill(null));
  }
  const protectors = { [GameConfig.PLAYER_1]: 0, [GameConfig.PLAYER_2]: 0 };
  const pieceCounts = { [GameConfig.PLAYER_1]: 0, [GameConfig.PLAYER_2]: 0 };

  for (const p of placements) {
    const pawn = GameLogic.createPawn(p.player, p.power, !!p.isProtector);
    board[p.row][p.col] = pawn;
    pieceCounts[p.player] += 1;
    if (p.isProtector) protectors[p.player] += 1;
  }

  return {
    board,
    currentPlayer,
    protectors,
    pieceCounts,
    winner: null,
    turnNumber: 1,
  };
}

/* ================================================================
   1. INITIAL STATE
   ================================================================ */

describe('Initial state', () => {
  test('board has correct dimensions', () => {
    const s = GameLogic.createInitialState();
    expect(s.board.length).toBe(GameConfig.BOARD_HEIGHT);
    s.board.forEach(row => expect(row.length).toBe(GameConfig.BOARD_WIDTH));
  });

  test('Player 1 (Salt) fills the top row', () => {
    const s = GameLogic.createInitialState();
    for (let c = 0; c < GameConfig.BOARD_WIDTH; c++) {
      const p = s.board[0][c];
      expect(p).not.toBeNull();
      expect(p.player).toBe(GameConfig.PLAYER_1);
      expect(p.power).toBe(GameConfig.STARTING_POWER);
    }
  });

  test('Player 2 (Pepper) fills the bottom row', () => {
    const s = GameLogic.createInitialState();
    const lastRow = GameConfig.BOARD_HEIGHT - 1;
    for (let c = 0; c < GameConfig.BOARD_WIDTH; c++) {
      const p = s.board[lastRow][c];
      expect(p).not.toBeNull();
      expect(p.player).toBe(GameConfig.PLAYER_2);
      expect(p.power).toBe(GameConfig.STARTING_POWER);
    }
  });

  test('middle rows are empty', () => {
    const s = GameLogic.createInitialState();
    for (let r = 1; r < GameConfig.BOARD_HEIGHT - 1; r++) {
      for (let c = 0; c < GameConfig.BOARD_WIDTH; c++) {
        expect(s.board[r][c]).toBeNull();
      }
    }
  });

  test('Player 1 moves first', () => {
    const s = GameLogic.createInitialState();
    expect(s.currentPlayer).toBe(GameConfig.PLAYER_1);
  });
});

/* ================================================================
   2. MOVEMENT
   ================================================================ */

describe('Movement', () => {
  test('pawn can move 1 step up', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1 }]);
    const r = GameLogic.validateMove(s, 2, 1, 1, 1);
    expect(r.valid).toBe(true);
    expect(r.type).toBe('move');
  });

  test('pawn can move 1 step down', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1 }]);
    const r = GameLogic.validateMove(s, 2, 1, 3, 1);
    expect(r.valid).toBe(true);
  });

  test('pawn can move 1 step left', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 2 }]);
    const r = GameLogic.validateMove(s, 2, 2, 2, 1);
    expect(r.valid).toBe(true);
  });

  test('pawn can move 1 step right', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1 }]);
    const r = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(r.valid).toBe(true);
  });

  test('diagonal move is rejected', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 2 }]);
    const r = GameLogic.validateMove(s, 2, 2, 3, 3);
    expect(r.valid).toBe(false);
  });

  test('moving 2 steps is rejected', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1 }]);
    const r = GameLogic.validateMove(s, 2, 1, 4, 1);
    expect(r.valid).toBe(false);
  });

  test('moving out of bounds is rejected', () => {
    const s = buildState([{ player: 1, power: 1, row: 0, col: 0 }]);
    const r = GameLogic.validateMove(s, 0, 0, -1, 0);
    expect(r.valid).toBe(false);
  });

  test('moving an empty square is rejected', () => {
    const s = buildState([]);
    const r = GameLogic.validateMove(s, 2, 2, 2, 3);
    expect(r.valid).toBe(false);
  });

  test('moving opponent pawn is rejected', () => {
    const s = buildState([{ player: 2, power: 1, row: 2, col: 1 }], GameConfig.PLAYER_1);
    const r = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(r.valid).toBe(false);
  });

  test('after a valid move, the turn switches', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 4, col: 0 },
    ]);
    const res = GameLogic.executeMove(s, 2, 1, 3, 1);
    expect(res.success).toBe(true);
    expect(res.state.currentPlayer).toBe(GameConfig.PLAYER_2);
  });
});

/* ================================================================
   3. MERGING
   ================================================================ */

describe('Merging', () => {
  test('1 + 1 = 2  (valid merge)', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 1, power: 1, row: 2, col: 2 },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(true);
    expect(v.type).toBe('merge');

    const res = GameLogic.executeMove(s, 2, 1, 2, 2);
    expect(res.success).toBe(true);
    expect(res.state.board[2][2].power).toBe(2);
    expect(res.state.board[2][1]).toBeNull();
    // piece count decreases by 1
    expect(res.state.pieceCounts[1]).toBe(1);
  });

  test('1 + 2 is rejected (would exceed max power)', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 1, power: 2, row: 2, col: 2 },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('2 + 1 is rejected', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1 },
      { player: 1, power: 1, row: 2, col: 2 },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('2 + 2 is rejected', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1 },
      { player: 1, power: 2, row: 2, col: 2 },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });
});

/* ================================================================
   4. STANDARD EATING (attacker >= defender)
   ================================================================ */

describe('Standard Capture', () => {
  test('1 can capture 1', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 2, col: 2 },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(true);
    expect(v.type).toBe('capture');
  });

  test('2 can capture 1', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1 },
      { player: 2, power: 1, row: 2, col: 2 },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(true);
    expect(v.type).toBe('capture');
  });

  test('2 can capture 2', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1 },
      { player: 2, power: 2, row: 2, col: 2 },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(true);
  });

  test('1 cannot capture 2', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 2, row: 2, col: 2 },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('capturing removes opponent piece count', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 2, col: 2 },
    ]);
    const res = GameLogic.executeMove(s, 2, 1, 2, 2);
    expect(res.success).toBe(true);
    expect(res.state.pieceCounts[2]).toBe(0);
  });

  test('capturing last opponent piece wins the game', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 2, col: 2 },
    ]);
    const res = GameLogic.executeMove(s, 2, 1, 2, 2);
    expect(res.state.winner).toBe(1);
  });
});

/* ================================================================
   5. PROTECTOR EATING (attacker > defender; ties fail)
   ================================================================ */

describe('Protector Capture', () => {
  test('1 cannot capture Protector-1 (tie fails)', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 2, col: 2, isProtector: true },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('2 can capture Protector-1 (strictly greater)', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1 },
      { player: 2, power: 1, row: 2, col: 2, isProtector: true },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(true);
    expect(v.type).toBe('capture');
  });

  test('2 cannot capture Protector-2 (equal not enough)', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1 },
      { player: 2, power: 2, row: 2, col: 2, isProtector: true },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('1 cannot capture Protector-2', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 2, row: 2, col: 2, isProtector: true },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('capturing a protector decrements protector count', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1 },
      { player: 2, power: 1, row: 2, col: 2, isProtector: true },
    ]);
    const res = GameLogic.executeMove(s, 2, 1, 2, 2);
    expect(res.success).toBe(true);
    expect(res.state.protectors[2]).toBe(0);
  });
});

/* ================================================================
   6. PROTECTOR ASSIGNMENT
   ================================================================ */

describe('Protector Assignment', () => {
  test('can assign a protector', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1 }]);
    const res = GameLogic.setProtector(s, 2, 1);
    expect(res.success).toBe(true);
    expect(res.state.board[2][1].isProtector).toBe(true);
    expect(res.state.protectors[1]).toBe(1);
  });

  test('cannot assign more than MAX protectors', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1, isProtector: true },
      { player: 1, power: 1, row: 3, col: 1 },
    ]);
    const res = GameLogic.setProtector(s, 3, 1);
    expect(res.success).toBe(false);
  });

  test('cannot assign protector to opponent pawn', () => {
    const s = buildState([{ player: 2, power: 1, row: 2, col: 1 }], GameConfig.PLAYER_1);
    const res = GameLogic.setProtector(s, 2, 1);
    expect(res.success).toBe(false);
  });

  test('cannot assign protector to already-protector pawn', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1, isProtector: true }]);
    const res = GameLogic.setProtector(s, 2, 1);
    expect(res.success).toBe(false);
  });
});

/* ================================================================
   7. PROMOTION
   ================================================================ */

describe('Promotion', () => {
  test('Player 1 pawn promotes at bottom row (row 4)', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 1, row: promoRow - 1, col: 0 },
      { player: 2, power: 1, row: 0, col: 3 }, // keep P2 alive
    ]);
    const res = GameLogic.executeMove(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    expect(res.state.board[promoRow][0].power).toBe(GameConfig.PROMOTION_VALUE);
  });

  test('Player 2 pawn promotes at top row (row 0)', () => {
    const s = buildState([
      { player: 2, power: 1, row: 1, col: 0 },
      { player: 1, power: 1, row: 4, col: 3 }, // keep P1 alive
    ], GameConfig.PLAYER_2);
    const res = GameLogic.executeMove(s, 1, 0, 0, 0);
    expect(res.success).toBe(true);
    expect(res.state.board[0][0].power).toBe(GameConfig.PROMOTION_VALUE);
  });

  test('pawn already at power 2 is not changed on promotion row', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 2, row: promoRow - 1, col: 0 },
      { player: 2, power: 1, row: 0, col: 3 },
    ]);
    const res = GameLogic.executeMove(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    expect(res.state.board[promoRow][0].power).toBe(2);
  });

  test('promotion row helper returns correct rows', () => {
    expect(GameLogic.promotionRow(GameConfig.PLAYER_1)).toBe(GameConfig.BOARD_HEIGHT - 1);
    expect(GameLogic.promotionRow(GameConfig.PLAYER_2)).toBe(0);
  });
});

/* ================================================================
   8. VALID MOVES LIST / NO VALID MOVE
   ================================================================ */

describe('getValidMoves / hasValidMove', () => {
  test('initial state has valid moves for Player 1', () => {
    const s = GameLogic.createInitialState();
    expect(GameLogic.hasValidMove(s)).toBe(true);
    const moves = GameLogic.getValidMoves(s);
    expect(moves.length).toBeGreaterThan(0);
  });

  test('a lone pawn in the corner has limited moves', () => {
    const s = buildState([{ player: 1, power: 1, row: 0, col: 0 }]);
    const moves = GameLogic.getValidMoves(s);
    // top‑left corner: can go right (0,1) or down (1,0) = 2 moves
    expect(moves.length).toBe(2);
  });
});

/* ================================================================
   9. IMMUTABILITY – original state is not mutated
   ================================================================ */

describe('Immutability', () => {
  test('executeMove does not mutate the original state', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 3, col: 1 },
    ]);
    const originalBoard = JSON.stringify(s.board);
    GameLogic.executeMove(s, 2, 1, 3, 1);
    expect(JSON.stringify(s.board)).toBe(originalBoard);
  });
});
