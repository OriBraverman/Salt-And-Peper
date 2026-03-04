/**
 * Salt & Pepper – Comprehensive Unit Tests
 * ------------------------------------------
 * Covers every rule described in the updated README.md:
 *   1. Initial state & pawn data model
 *   2. Orthogonal-only, 1-step movement (attackers only)
 *   3. Merging limits (1+1=2 only, both attackers, promotedParts tracking)
 *   4. Standard capture (attacker >= enemy attacker)
 *   5. Defender mechanics (invincibility, stance switching, power-1 only)
 *   6. Promotion (power-1 → power-2, power-2 split on end row, promotedParts)
 *   7. Unpromotion (reaching own starting row)
 *   8. Unmerge (all target types, promotion tracking, edge cases)
 *   9. Valid moves list
 *  10. Immutability
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
  const pieceCounts = { [GameConfig.PLAYER_1]: 0, [GameConfig.PLAYER_2]: 0 };

  for (const p of placements) {
    const pawn = GameLogic.createPawn(
      p.player,
      p.power,
      !!p.isDefender,
      p.promotedParts != null ? p.promotedParts : 0,
    );
    board[p.row][p.col] = pawn;
    pieceCounts[p.player] += 1;
  }

  return {
    board,
    currentPlayer,
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

  test('Player 1 (Salt) fills the top row with correct defaults', () => {
    const s = GameLogic.createInitialState();
    for (let c = 0; c < GameConfig.BOARD_WIDTH; c++) {
      const p = s.board[0][c];
      expect(p).not.toBeNull();
      expect(p.player).toBe(GameConfig.PLAYER_1);
      expect(p.power).toBe(GameConfig.STARTING_POWER);
      expect(p.isDefender).toBe(false);
      expect(p.promotedParts).toBe(0);
    }
  });

  test('Player 2 (Pepper) fills the bottom row with correct defaults', () => {
    const s = GameLogic.createInitialState();
    const lastRow = GameConfig.BOARD_HEIGHT - 1;
    for (let c = 0; c < GameConfig.BOARD_WIDTH; c++) {
      const p = s.board[lastRow][c];
      expect(p).not.toBeNull();
      expect(p.player).toBe(GameConfig.PLAYER_2);
      expect(p.power).toBe(GameConfig.STARTING_POWER);
      expect(p.isDefender).toBe(false);
      expect(p.promotedParts).toBe(0);
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

  test('no protectors property on state (replaced by isDefender on pawns)', () => {
    const s = GameLogic.createInitialState();
    expect(s.protectors).toBeUndefined();
  });
});

/* ================================================================
   2. MOVEMENT
   ================================================================ */

describe('Movement', () => {
  test('attacker pawn can move 1 step up', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1 }]);
    const r = GameLogic.validateMove(s, 2, 1, 1, 1);
    expect(r.valid).toBe(true);
    expect(r.type).toBe('move');
  });

  test('attacker pawn can move 1 step down', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1 }]);
    const r = GameLogic.validateMove(s, 2, 1, 3, 1);
    expect(r.valid).toBe(true);
  });

  test('attacker pawn can move 1 step left', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 2 }]);
    const r = GameLogic.validateMove(s, 2, 2, 2, 1);
    expect(r.valid).toBe(true);
  });

  test('attacker pawn can move 1 step right', () => {
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

  test('defender pawn cannot move', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1, isDefender: true }]);
    const r = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/[Dd]efender/);
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

  test('merging tracks promotedParts (unpromoted + unpromoted = 0)', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1, promotedParts: 0 },
      { player: 1, power: 1, row: 2, col: 2, promotedParts: 0 },
    ]);
    const res = GameLogic.executeMove(s, 2, 1, 2, 2);
    expect(res.state.board[2][2].promotedParts).toBe(0);
  });

  test('merging tracks promotedParts (promoted + unpromoted = 1 mixed)', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1, promotedParts: 1 },
      { player: 1, power: 1, row: 2, col: 2, promotedParts: 0 },
    ]);
    const res = GameLogic.executeMove(s, 2, 1, 2, 2);
    expect(res.state.board[2][2].promotedParts).toBe(1);
  });

  test('merging tracks promotedParts (promoted + promoted = 2)', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1, promotedParts: 1 },
      { player: 1, power: 1, row: 2, col: 2, promotedParts: 1 },
    ]);
    const res = GameLogic.executeMove(s, 2, 1, 2, 2);
    expect(res.state.board[2][2].promotedParts).toBe(2);
  });

  test('cannot merge onto a friendly defender', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 1, power: 1, row: 2, col: 2, isDefender: true },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });
});

/* ================================================================
   4. STANDARD CAPTURE (attacker >= enemy attacker)
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
   5. DEFENDER MECHANICS
   ================================================================ */

describe('Defender Mechanics', () => {
  /* ── Invincibility ── */
  test('cannot capture an enemy defender (any power)', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1 },
      { player: 2, power: 1, row: 2, col: 2, isDefender: true },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/[Ii]nvincible|[Dd]efender/);
  });

  test('power-1 cannot capture enemy defender', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 2, col: 2, isDefender: true },
    ]);
    const v = GameLogic.validateMove(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  /* ── Become Defender ── */
  test('can set a power-1 attacker as defender', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 4, col: 0 },
    ]);
    const res = GameLogic.setDefender(s, 2, 1);
    expect(res.success).toBe(true);
    expect(res.state.board[2][1].isDefender).toBe(true);
  });

  test('setting defender switches the turn', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 4, col: 0 },
    ]);
    const res = GameLogic.setDefender(s, 2, 1);
    expect(res.state.currentPlayer).toBe(GameConfig.PLAYER_2);
  });

  test('cannot set a power-2 pawn as defender', () => {
    const s = buildState([{ player: 1, power: 2, row: 2, col: 1 }]);
    const res = GameLogic.setDefender(s, 2, 1);
    expect(res.success).toBe(false);
    expect(res.reason).toMatch(/power/i);
  });

  test('cannot set opponent pawn as defender', () => {
    const s = buildState([{ player: 2, power: 1, row: 2, col: 1 }], GameConfig.PLAYER_1);
    const res = GameLogic.setDefender(s, 2, 1);
    expect(res.success).toBe(false);
  });

  test('cannot set already-defender as defender', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1, isDefender: true }]);
    const res = GameLogic.setDefender(s, 2, 1);
    expect(res.success).toBe(false);
  });

  /* ── Become Attacker ── */
  test('can revert a defender back to attacker', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1, isDefender: true },
      { player: 2, power: 1, row: 4, col: 0 },
    ]);
    const res = GameLogic.setAttacker(s, 2, 1);
    expect(res.success).toBe(true);
    expect(res.state.board[2][1].isDefender).toBe(false);
  });

  test('setting attacker switches the turn', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1, isDefender: true },
      { player: 2, power: 1, row: 4, col: 0 },
    ]);
    const res = GameLogic.setAttacker(s, 2, 1);
    expect(res.state.currentPlayer).toBe(GameConfig.PLAYER_2);
  });

  test('cannot revert a non-defender to attacker', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1 }]);
    const res = GameLogic.setAttacker(s, 2, 1);
    expect(res.success).toBe(false);
  });

  /* ── Multiple defenders allowed ── */
  test('can have multiple defenders for the same player', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 0 },
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 4, col: 0 },
    ]);
    // Make first defender
    const res1 = GameLogic.setDefender(s, 2, 0);
    expect(res1.success).toBe(true);
    // Switch back to P1 for test
    const s2 = { ...res1.state, currentPlayer: GameConfig.PLAYER_1 };
    // Make second defender
    const res2 = GameLogic.setDefender(s2, 2, 1);
    expect(res2.success).toBe(true);
    expect(res2.state.board[2][0].isDefender).toBe(true);
    expect(res2.state.board[2][1].isDefender).toBe(true);
  });
});

/* ================================================================
   6. PROMOTION
   ================================================================ */

describe('Promotion', () => {
  test('Player 1 unpromoted power-1 promotes to power-2 (promotedParts=2) at bottom row', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 1, row: promoRow - 1, col: 0, promotedParts: 0 },
      { player: 2, power: 1, row: 0, col: 3 },
    ]);
    const res = GameLogic.executeMove(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    const pawn = res.state.board[promoRow][0];
    expect(pawn.power).toBe(GameConfig.PROMOTION_VALUE);
    expect(pawn.promotedParts).toBe(2);
  });

  test('Player 2 unpromoted power-1 promotes to power-2 at top row', () => {
    const s = buildState([
      { player: 2, power: 1, row: 1, col: 0, promotedParts: 0 },
      { player: 1, power: 1, row: 4, col: 3 },
    ], GameConfig.PLAYER_2);
    const res = GameLogic.executeMove(s, 1, 0, 0, 0);
    expect(res.success).toBe(true);
    expect(res.state.board[0][0].power).toBe(GameConfig.PROMOTION_VALUE);
    expect(res.state.board[0][0].promotedParts).toBe(2);
  });

  test('already promoted power-1 does NOT re-promote (stays power 1)', () => {
    // A promoted power-1 reaching the end row again should not change
    // (it's already promoted, promotedParts=1)
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 1, row: promoRow - 1, col: 0, promotedParts: 1 },
      { player: 2, power: 1, row: 0, col: 3 },
    ]);
    const res = GameLogic.executeMove(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    // Since promotedParts is already 1 (not 0), it should not promote
    expect(res.state.board[promoRow][0].power).toBe(1);
    expect(res.state.board[promoRow][0].promotedParts).toBe(1);
  });

  test('power-2 fully unpromoted (promotedParts=0) reaching end row splits', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 2, row: promoRow - 1, col: 0, promotedParts: 0 },
      { player: 2, power: 1, row: 0, col: 3 },
    ]);
    const res = GameLogic.executeMove(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    // Destination: power-2, promotedParts=2
    const dst = res.state.board[promoRow][0];
    expect(dst.power).toBe(2);
    expect(dst.promotedParts).toBe(2);
    // Origin: power-1 leftover, unpromoted
    const leftover = res.state.board[promoRow - 1][0];
    expect(leftover).not.toBeNull();
    expect(leftover.power).toBe(1);
    expect(leftover.promotedParts).toBe(0);
    // Piece count increases by 1
    expect(res.state.pieceCounts[1]).toBe(2);
  });

  test('power-2 mixed (promotedParts=1) reaching end row splits, leftover is promoted', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 2, row: promoRow - 1, col: 0, promotedParts: 1 },
      { player: 2, power: 1, row: 0, col: 3 },
    ]);
    const res = GameLogic.executeMove(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    const dst = res.state.board[promoRow][0];
    expect(dst.power).toBe(2);
    expect(dst.promotedParts).toBe(2);
    const leftover = res.state.board[promoRow - 1][0];
    expect(leftover.power).toBe(1);
    expect(leftover.promotedParts).toBe(1);
  });

  test('power-2 fully promoted (promotedParts=2) reaching end row does NOT split', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 2, row: promoRow - 1, col: 0, promotedParts: 2 },
      { player: 2, power: 1, row: 0, col: 3 },
    ]);
    const res = GameLogic.executeMove(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    expect(res.state.board[promoRow][0].power).toBe(2);
    expect(res.state.board[promoRow][0].promotedParts).toBe(2);
    // No leftover
    expect(res.state.board[promoRow - 1][0]).toBeNull();
    expect(res.state.pieceCounts[1]).toBe(1);
  });

  test('promotion row helper returns correct rows', () => {
    expect(GameLogic.promotionRow(GameConfig.PLAYER_1)).toBe(GameConfig.BOARD_HEIGHT - 1);
    expect(GameLogic.promotionRow(GameConfig.PLAYER_2)).toBe(0);
  });

  test('promotion via capture (power-1 captures on end row)', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 1, row: promoRow - 1, col: 0, promotedParts: 0 },
      { player: 2, power: 1, row: promoRow, col: 0 },
    ]);
    const res = GameLogic.executeMove(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    expect(res.state.board[promoRow][0].power).toBe(2);
    expect(res.state.board[promoRow][0].promotedParts).toBe(2);
    expect(res.state.pieceCounts[2]).toBe(0);
  });
});

/* ================================================================
   7. UNPROMOTION
   ================================================================ */

describe('Unpromotion', () => {
  test('promoted power-1 reaching own starting row unpromotes', () => {
    // Player 1 starts at row 0, so row 0 is own starting row
    const s = buildState([
      { player: 1, power: 1, row: 1, col: 0, promotedParts: 1 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const res = GameLogic.executeMove(s, 1, 0, 0, 0);
    expect(res.success).toBe(true);
    expect(res.state.board[0][0].promotedParts).toBe(0);
  });

  test('unpromoted power-1 reaching own starting row stays unpromoted', () => {
    const s = buildState([
      { player: 1, power: 1, row: 1, col: 0, promotedParts: 0 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const res = GameLogic.executeMove(s, 1, 0, 0, 0);
    expect(res.success).toBe(true);
    expect(res.state.board[0][0].promotedParts).toBe(0);
  });

  test('Player 2 promoted pawn reaching row 4 (own start) unpromotes', () => {
    const ownRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 2, power: 1, row: ownRow - 1, col: 0, promotedParts: 1 },
      { player: 1, power: 1, row: 0, col: 3 },
    ], GameConfig.PLAYER_2);
    const res = GameLogic.executeMove(s, ownRow - 1, 0, ownRow, 0);
    expect(res.success).toBe(true);
    expect(res.state.board[ownRow][0].promotedParts).toBe(0);
  });
});

/* ================================================================
   8. UNMERGE
   ================================================================ */

describe('Unmerge — Basic', () => {
  test('power-2 can unmerge into empty adjacent space', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const v = GameLogic.validateUnmerge(s, 2, 1, 2, 2);
    expect(v.valid).toBe(true);
    expect(v.targetType).toBe('empty');

    const res = GameLogic.executeUnmerge(s, 2, 1, 2, 2);
    expect(res.success).toBe(true);
    // Origin: power-1
    expect(res.state.board[2][1].power).toBe(1);
    // Target: power-1
    expect(res.state.board[2][2].power).toBe(1);
    // Piece count goes up by 1
    expect(res.state.pieceCounts[1]).toBe(2);
  });

  test('power-1 cannot unmerge', () => {
    const s = buildState([{ player: 1, power: 1, row: 2, col: 1 }]);
    const v = GameLogic.validateUnmerge(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('defender cannot unmerge', () => {
    const s = buildState([{ player: 1, power: 2, row: 2, col: 1, isDefender: true }]);
    const v = GameLogic.validateUnmerge(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('unmerge switches the turn', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const res = GameLogic.executeUnmerge(s, 2, 1, 2, 2);
    expect(res.state.currentPlayer).toBe(GameConfig.PLAYER_2);
  });

  test('unmerge cannot target out of bounds', () => {
    const s = buildState([{ player: 1, power: 2, row: 0, col: 0, promotedParts: 0 }]);
    const v = GameLogic.validateUnmerge(s, 0, 0, -1, 0);
    expect(v.valid).toBe(false);
  });

  test('unmerge diagonal is rejected', () => {
    const s = buildState([{ player: 1, power: 2, row: 2, col: 1, promotedParts: 0 }]);
    const v = GameLogic.validateUnmerge(s, 2, 1, 3, 2);
    expect(v.valid).toBe(false);
  });
});

describe('Unmerge — Promotion Tracking', () => {
  test('unpromoted (0) splits into two unpromoted', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const res = GameLogic.executeUnmerge(s, 2, 1, 2, 2);
    expect(res.state.board[2][1].promotedParts).toBe(0);
    expect(res.state.board[2][2].promotedParts).toBe(0);
  });

  test('mixed (1) splits into promoted (stay) + unpromoted (go)', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 1 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const res = GameLogic.executeUnmerge(s, 2, 1, 2, 2);
    expect(res.state.board[2][1].promotedParts).toBe(1); // staying = promoted
    expect(res.state.board[2][2].promotedParts).toBe(0); // going = unpromoted
  });

  test('fully promoted (2) splits into two promoted parts', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 2 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const res = GameLogic.executeUnmerge(s, 2, 1, 2, 2);
    expect(res.state.board[2][1].promotedParts).toBe(1);
    expect(res.state.board[2][2].promotedParts).toBe(1);
  });
});

describe('Unmerge — Onto Friendly (re-merge)', () => {
  test('unmerge onto friendly power-1 attacker triggers merge', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 1, power: 1, row: 2, col: 2, promotedParts: 0 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const v = GameLogic.validateUnmerge(s, 2, 1, 2, 2);
    expect(v.valid).toBe(true);
    expect(v.targetType).toBe('merge');

    const res = GameLogic.executeUnmerge(s, 2, 1, 2, 2);
    expect(res.success).toBe(true);
    // Stay: power-1 at origin
    expect(res.state.board[2][1].power).toBe(1);
    // Target: merged power-2
    expect(res.state.board[2][2].power).toBe(2);
    // Piece count: started with 2 + split (+1) - merge (-1) = 2
    expect(res.state.pieceCounts[1]).toBe(2);
  });

  test('unmerge onto friendly defender is rejected', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 1, power: 1, row: 2, col: 2, isDefender: true },
    ]);
    const v = GameLogic.validateUnmerge(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('unmerge onto friendly power-2 is rejected', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 1, power: 2, row: 2, col: 2, promotedParts: 0 },
    ]);
    const v = GameLogic.validateUnmerge(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });
});

describe('Unmerge — Onto Enemy (capture)', () => {
  test('unmerge onto enemy power-1 attacker captures it', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 2, power: 1, row: 2, col: 2 },
    ]);
    const v = GameLogic.validateUnmerge(s, 2, 1, 2, 2);
    expect(v.valid).toBe(true);
    expect(v.targetType).toBe('capture');

    const res = GameLogic.executeUnmerge(s, 2, 1, 2, 2);
    expect(res.success).toBe(true);
    expect(res.state.board[2][2].player).toBe(1);
    expect(res.state.pieceCounts[2]).toBe(0);
  });

  test('unmerge onto enemy power-2 attacker is rejected (split pawn is power 1)', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 2, power: 2, row: 2, col: 2 },
    ]);
    const v = GameLogic.validateUnmerge(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('unmerge onto enemy defender is rejected', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 2, power: 1, row: 2, col: 2, isDefender: true },
    ]);
    const v = GameLogic.validateUnmerge(s, 2, 1, 2, 2);
    expect(v.valid).toBe(false);
  });

  test('capturing last enemy via unmerge wins the game', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 2, power: 1, row: 2, col: 2 },
    ]);
    const res = GameLogic.executeUnmerge(s, 2, 1, 2, 2);
    expect(res.state.winner).toBe(1);
  });
});

describe('Unmerge — Onto Enemy Line (special promotion)', () => {
  test('unpromoted power-2 unmerge onto enemy line → go pawn becomes power-2 promoted', () => {
    // Player 1 promotion row = 4 (bottom)
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 2, row: promoRow - 1, col: 0, promotedParts: 0 },
      { player: 2, power: 1, row: 0, col: 3 },
    ]);
    const res = GameLogic.executeUnmerge(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    // Staying: power-1, unpromoted
    const stay = res.state.board[promoRow - 1][0];
    expect(stay.power).toBe(1);
    expect(stay.promotedParts).toBe(0);
    // Going: promoted to power-2
    const go = res.state.board[promoRow][0];
    expect(go.power).toBe(2);
    expect(go.promotedParts).toBe(2);
  });

  test('mixed power-2 unmerge onto enemy line → go pawn becomes power-2 promoted, stay is promoted', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 2, row: promoRow - 1, col: 0, promotedParts: 1 },
      { player: 2, power: 1, row: 0, col: 3 },
    ]);
    const res = GameLogic.executeUnmerge(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    const stay = res.state.board[promoRow - 1][0];
    expect(stay.power).toBe(1);
    expect(stay.promotedParts).toBe(1);
    const go = res.state.board[promoRow][0];
    expect(go.power).toBe(2);
    expect(go.promotedParts).toBe(2);
  });

  test('fully promoted power-2 unmerge onto enemy line does NOT trigger special promotion', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 2, row: promoRow - 1, col: 0, promotedParts: 2 },
      { player: 2, power: 1, row: 0, col: 3 },
    ]);
    const res = GameLogic.executeUnmerge(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    // Should be a normal split — both power-1
    const stay = res.state.board[promoRow - 1][0];
    expect(stay.power).toBe(1);
    expect(stay.promotedParts).toBe(1);
    const go = res.state.board[promoRow][0];
    expect(go.power).toBe(1);
    expect(go.promotedParts).toBe(1);
  });

  test('unmerge-promote captures enemy on the promotion row', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 2, row: promoRow - 1, col: 0, promotedParts: 0 },
      { player: 2, power: 1, row: promoRow, col: 0 },
    ]);
    const res = GameLogic.executeUnmerge(s, promoRow - 1, 0, promoRow, 0);
    expect(res.success).toBe(true);
    expect(res.state.board[promoRow][0].player).toBe(1);
    expect(res.state.board[promoRow][0].power).toBe(2);
    expect(res.state.pieceCounts[2]).toBe(0);
  });

  test('unmerge-promote can capture enemy power-2 attacker (since promoted to power 2)', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 2, row: promoRow - 1, col: 0, promotedParts: 0 },
      { player: 2, power: 2, row: promoRow, col: 0 },
    ]);
    const v = GameLogic.validateUnmerge(s, promoRow - 1, 0, promoRow, 0);
    expect(v.valid).toBe(true);
    expect(v.targetType).toBe('capture');
  });

  test('unmerge-promote onto friendly power-1 is rejected (would exceed max power)', () => {
    const promoRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 1, power: 2, row: promoRow - 1, col: 0, promotedParts: 0 },
      { player: 1, power: 1, row: promoRow, col: 0 },
    ]);
    const v = GameLogic.validateUnmerge(s, promoRow - 1, 0, promoRow, 0);
    expect(v.valid).toBe(false);
  });
});

describe('Unmerge — Unpromotion edge case', () => {
  test('going pawn landing on own starting row unpromotes', () => {
    // Player 2 start row = 4. If P2 has a power-2 promoted at row 3,
    // unmerging down to row 4 should unpromote the going pawn.
    const ownRow = GameConfig.BOARD_HEIGHT - 1;
    const s = buildState([
      { player: 2, power: 2, row: ownRow - 1, col: 0, promotedParts: 2 },
      { player: 1, power: 1, row: 0, col: 3 },
    ], GameConfig.PLAYER_2);
    const res = GameLogic.executeUnmerge(s, ownRow - 1, 0, ownRow, 0);
    expect(res.success).toBe(true);
    const go = res.state.board[ownRow][0];
    expect(go.power).toBe(1);
    expect(go.promotedParts).toBe(0); // unpromoted due to landing on own row
  });
});

/* ================================================================
   9. VALID MOVES LIST / NO VALID MOVE
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
    // top-left corner: can go right (0,1) or down (1,0) = 2 movement moves
    // + setDefender = 1
    expect(moves.length).toBe(3);
    expect(moves.filter(m => m.type === 'setDefender').length).toBe(1);
  });

  test('a power-2 pawn lists unmerge targets', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 2, promotedParts: 0 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const moves = GameLogic.getValidMoves(s);
    const unmergeMoves = moves.filter(m => m.type === 'unmerge');
    expect(unmergeMoves.length).toBe(4); // up, down, left, right all empty
  });

  test('a defender pawn only has setAttacker as valid action', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 2, isDefender: true },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const moves = GameLogic.getValidMoves(s);
    expect(moves.length).toBe(1);
    expect(moves[0].type).toBe('setAttacker');
  });
});

/* ================================================================
   10. IMMUTABILITY – original state is not mutated
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

  test('executeUnmerge does not mutate the original state', () => {
    const s = buildState([
      { player: 1, power: 2, row: 2, col: 1, promotedParts: 0 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const originalBoard = JSON.stringify(s.board);
    GameLogic.executeUnmerge(s, 2, 1, 2, 2);
    expect(JSON.stringify(s.board)).toBe(originalBoard);
  });

  test('setDefender does not mutate the original state', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1 },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const originalBoard = JSON.stringify(s.board);
    GameLogic.setDefender(s, 2, 1);
    expect(JSON.stringify(s.board)).toBe(originalBoard);
  });

  test('setAttacker does not mutate the original state', () => {
    const s = buildState([
      { player: 1, power: 1, row: 2, col: 1, isDefender: true },
      { player: 2, power: 1, row: 4, col: 3 },
    ]);
    const originalBoard = JSON.stringify(s.board);
    GameLogic.setAttacker(s, 2, 1);
    expect(JSON.stringify(s.board)).toBe(originalBoard);
  });
});
