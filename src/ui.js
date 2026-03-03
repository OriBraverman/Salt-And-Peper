/**
 * Salt & Pepper – UI Renderer
 * ----------------------------
 * Builds the CSS-Grid board, renders pawns, handles click interactions.
 * Depends on: GameConfig, GameLogic (loaded before this script).
 */

/* global GameConfig, GameLogic */

const UI = (() => {
  /* ── DOM refs (set once in init) ─────────────────────── */
  let boardEl, turnEl, scoreP1El, scoreP2El, msgEl, protectorBtn;

  /* ── Selection state ─────────────────────────────────── */
  let selectedCell = null;      // { row, col }
  let validTargets = [];        // [{ fromR, fromC, toR, toC, type }]

  /* ── Callback provided by main.js ───────────────────── */
  let onMoveCallback = null;    // (fromR, fromC, toR, toC) => void
  let onProtectorCallback = null; // (row, col) => void

  /* ============================================================
     Public API
     ============================================================ */

  function init ({ onMove, onProtector }) {
    boardEl      = document.getElementById('board');
    turnEl       = document.getElementById('turn-indicator');
    scoreP1El    = document.getElementById('score-p1');
    scoreP2El    = document.getElementById('score-p2');
    msgEl        = document.getElementById('message-bar');
    protectorBtn = document.getElementById('btn-protector');

    onMoveCallback      = onMove;
    onProtectorCallback = onProtector;

    // Build grid template
    boardEl.style.gridTemplateColumns = `repeat(${GameConfig.BOARD_WIDTH}, 1fr)`;
    boardEl.style.gridTemplateRows    = `repeat(${GameConfig.BOARD_HEIGHT}, 1fr)`;

    protectorBtn.addEventListener('click', handleProtectorClick);
  }

  /** Full render of board + HUD from a state object. */
  function render (state, localPlayer) {
    renderBoard(state, localPlayer);
    renderHUD(state, localPlayer);
  }

  function showMessage (msg) { msgEl.textContent = msg; }
  function clearMessage ()   { msgEl.textContent = ''; }

  function showWinner (playerNum) {
    const name = playerNum === GameConfig.PLAYER_1
      ? GameConfig.PLAYER_1_NAME
      : GameConfig.PLAYER_2_NAME;

    const overlay = document.createElement('div');
    overlay.className = 'winner-overlay';
    overlay.innerHTML = `
      <div class="winner-card">
        <h2>🎉 ${name} Wins! 🎉</h2>
        <p>Player ${playerNum} has captured all opposing pieces.</p>
        <button id="btn-winner-restart">Play Again</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-winner-restart').addEventListener('click', () => {
      overlay.remove();
      document.getElementById('btn-restart').click();
    });
  }

  /* ============================================================
     Board rendering
     ============================================================ */

  function renderBoard (state, localPlayer) {
    boardEl.innerHTML = '';
    clearSelection();

    for (let r = 0; r < GameConfig.BOARD_HEIGHT; r++) {
      for (let c = 0; c < GameConfig.BOARD_WIDTH; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        cell.dataset.row = r;
        cell.dataset.col = c;

        const pawn = state.board[r][c];
        if (pawn) {
          const pawnEl = document.createElement('div');
          const side = pawn.player === GameConfig.PLAYER_1 ? 'salt' : 'pepper';
          pawnEl.className = `pawn ${side}` +
            (pawn.power >= 2 ? ' power-2' : '') +
            (pawn.isProtector ? ' protector' : '');
          pawnEl.textContent = pawn.power;
          cell.appendChild(pawnEl);
          cell.classList.add('has-piece');
        }

        cell.addEventListener('click', () => handleCellClick(r, c, state, localPlayer));
        boardEl.appendChild(cell);
      }
    }
  }

  /* ── HUD ───────────────────────────────────────────── */

  function renderHUD (state, localPlayer) {
    const current = state.currentPlayer;
    const name = current === GameConfig.PLAYER_1
      ? GameConfig.PLAYER_1_NAME
      : GameConfig.PLAYER_2_NAME;
    const side = current === GameConfig.PLAYER_1 ? 'salt' : 'pepper';

    turnEl.textContent = `${name}'s Turn`;
    turnEl.className = side;

    scoreP1El.textContent = `🧂 Salt: ${state.pieceCounts[GameConfig.PLAYER_1]}`;
    scoreP2El.textContent = `🌶️ Pepper: ${state.pieceCounts[GameConfig.PLAYER_2]}`;

    // Protector button state
    if (localPlayer !== null && state.currentPlayer !== localPlayer) {
      protectorBtn.disabled = true;
    } else {
      protectorBtn.disabled = !selectedCell;
    }
  }

  /* ============================================================
     Interaction
     ============================================================ */

  function handleCellClick (row, col, state, localPlayer) {
    // If playing online and it's not our turn, ignore
    if (localPlayer !== null && state.currentPlayer !== localPlayer) return;

    const clickedPawn = state.board[row][col];

    // ── If a pawn is already selected ──
    if (selectedCell) {
      // Clicked a valid target → execute the move
      const target = validTargets.find(t => t.toR === row && t.toC === col);
      if (target) {
        if (onMoveCallback) onMoveCallback(selectedCell.row, selectedCell.col, row, col);
        clearSelection();
        return;
      }
      // Clicked own pawn → reselect
      if (clickedPawn && clickedPawn.player === state.currentPlayer) {
        selectPawn(row, col, state);
        return;
      }
      // Clicked elsewhere → deselect
      clearSelection();
      return;
    }

    // ── No selection yet → select own pawn ──
    if (clickedPawn && clickedPawn.player === state.currentPlayer) {
      selectPawn(row, col, state);
    }
  }

  function selectPawn (row, col, state) {
    clearSelection();
    selectedCell = { row, col };

    // Highlight selected cell
    getCellEl(row, col)?.classList.add('selected');

    // Find valid targets
    validTargets = GameLogic.getValidMoves(state)
      .filter(m => m.fromR === row && m.fromC === col);

    validTargets.forEach(t => {
      getCellEl(t.toR, t.toC)?.classList.add('valid-target');
    });

    // Enable protector button if applicable
    if (protectorBtn) protectorBtn.disabled = false;
  }

  function clearSelection () {
    selectedCell = null;
    validTargets = [];
    boardEl?.querySelectorAll('.selected, .valid-target').forEach(el => {
      el.classList.remove('selected', 'valid-target');
    });
    if (protectorBtn) protectorBtn.disabled = true;
  }

  function handleProtectorClick () {
    if (!selectedCell) return;
    if (onProtectorCallback) {
      onProtectorCallback(selectedCell.row, selectedCell.col);
    }
    clearSelection();
  }

  /* ── Helpers ───────────────────────────────────────── */

  function getCellEl (r, c) {
    return boardEl?.querySelector(`[data-row="${r}"][data-col="${c}"]`);
  }

  /* ── Public surface ────────────────────────────────── */
  return { init, render, showMessage, clearMessage, showWinner };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UI;
}
