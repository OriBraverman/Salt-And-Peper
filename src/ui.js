/**
 * Salt & Pepper – UI Renderer
 * Copyright (c) 2026 Ben Dov Bloch and Ori Braverman
 * ----------------------------
 * Builds the CSS-Grid board, renders pawns, handles click interactions.
 * Depends on: GameConfig, GameLogic (loaded before this script).
 */

/* global GameConfig, GameLogic */

const UI = (() => {
  /* ── DOM refs (set once in init) ─────────────────────── */
  let boardEl, turnEl, scoreP1El, scoreP2El, msgEl;
  let defenderBtn, attackerBtn, unmergeBtn;

  /* ── Selection state ─────────────────────────────────── */
  let selectedCell = null;      // { row, col }
  let validTargets = [];        // [{ fromR, fromC, toR, toC, type }]
  let unmergeMode = false;      // when true, clicking a target performs unmerge

  /* ── Callback provided by main.js ───────────────────── */
  let onMoveCallback = null;       // (fromR, fromC, toR, toC) => void
  let onDefenderCallback = null;   // (row, col) => void
  let onAttackerCallback = null;   // (row, col) => void
  let onUnmergeCallback = null;    // (fromR, fromC, toR, toC) => void

  /* ============================================================
     Public API
     ============================================================ */

  function init ({ onMove, onDefender, onAttacker, onUnmerge }) {
    boardEl      = document.getElementById('board');
    turnEl       = document.getElementById('turn-indicator');
    scoreP1El    = document.getElementById('score-p1');
    scoreP2El    = document.getElementById('score-p2');
    msgEl        = document.getElementById('message-bar');
    defenderBtn  = document.getElementById('btn-defender');
    attackerBtn  = document.getElementById('btn-attacker');
    unmergeBtn   = document.getElementById('btn-unmerge');

    onMoveCallback     = onMove;
    onDefenderCallback = onDefender;
    onAttackerCallback = onAttacker;
    onUnmergeCallback  = onUnmerge;

    // Build grid template
    boardEl.style.gridTemplateColumns = `repeat(${GameConfig.BOARD_WIDTH}, 1fr)`;
    boardEl.style.gridTemplateRows    = `repeat(${GameConfig.BOARD_HEIGHT}, 1fr)`;

    defenderBtn.addEventListener('click', handleDefenderClick);
    attackerBtn.addEventListener('click', handleAttackerClick);
    unmergeBtn.addEventListener('click', handleUnmergeClick);
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

        // Label rows on the left edge
        if (c === 0) {
          cell.dataset.rowLabel = GameConfig.BOARD_HEIGHT - r;
        }

        // Label columns on the bottom edge
        if (r === GameConfig.BOARD_HEIGHT - 1) {
          cell.dataset.colLabel = String.fromCharCode(65 + c); // A, B, C...
        }

        const pawn = state.board[r][c];
        if (pawn) {
          const pawnEl = document.createElement('div');
          const side = pawn.player === GameConfig.PLAYER_1 ? 'salt' : 'pepper';
          pawnEl.className = `pawn ${side}` +
            (pawn.power >= 2 ? ' power-2' : '') +
            (pawn.isDefender ? ' defender' : '') +
            (pawn.promotedParts === 1 ? ' promoted-1' : '') +
            (pawn.promotedParts === 2 ? ' promoted-2' : '');
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

    const isMyTurn = localPlayer === null || state.currentPlayer === localPlayer;

    // Action button states
    defenderBtn.disabled = true;
    attackerBtn.disabled = true;
    unmergeBtn.disabled = true;

    if (isMyTurn && selectedCell) {
      const pawn = state.board[selectedCell.row][selectedCell.col];
      if (pawn && pawn.player === state.currentPlayer) {
        if (!pawn.isDefender && pawn.power === 1) defenderBtn.disabled = false;
        if (pawn.isDefender) attackerBtn.disabled = false;
        if (!pawn.isDefender && pawn.power === GameConfig.MAX_POWER_LEVEL) unmergeBtn.disabled = false;
      }
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
      // Clicked a valid target → execute the move/unmerge
      const target = validTargets.find(t => t.toR === row && t.toC === col);
      if (target) {
        if (unmergeMode) {
          if (onUnmergeCallback) onUnmergeCallback(selectedCell.row, selectedCell.col, row, col);
        } else {
          if (onMoveCallback) onMoveCallback(selectedCell.row, selectedCell.col, row, col);
        }
        clearSelection();
        return;
      }
      // Clicked own pawn → deselect if it's the same, otherwise reselect
      if (clickedPawn && clickedPawn.player === state.currentPlayer) {
        if (selectedCell.row === row && selectedCell.col === col) {
          clearSelection();
        } else {
          selectPawn(row, col, state);
        }
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
    unmergeMode = false;

    // Highlight selected cell
    getCellEl(row, col)?.classList.add('selected');

    // Find valid move targets (not unmerge — that requires the unmerge button)
    validTargets = GameLogic.getValidMoves(state)
      .filter(m => m.fromR === row && m.fromC === col && m.type !== 'unmerge'
                 && m.type !== 'setDefender' && m.type !== 'setAttacker');

    validTargets.forEach(t => {
      getCellEl(t.toR, t.toC)?.classList.add('valid-target');
    });

    // Update action button states
    const pawn = state.board[row][col];
    if (pawn) {
      defenderBtn.disabled = !(pawn.power === 1 && !pawn.isDefender);
      attackerBtn.disabled = !pawn.isDefender;
      unmergeBtn.disabled = !(pawn.power === GameConfig.MAX_POWER_LEVEL && !pawn.isDefender);
    }
  }

  function enterUnmergeMode (state) {
    if (!selectedCell) return;

    // Clear current highlights
    boardEl?.querySelectorAll('.valid-target').forEach(el => {
      el.classList.remove('valid-target');
    });

    unmergeMode = true;

    // Find valid unmerge targets
    validTargets = GameLogic.getValidMoves(state)
      .filter(m => m.fromR === selectedCell.row && m.fromC === selectedCell.col
                 && m.type === 'unmerge');

    validTargets.forEach(t => {
      getCellEl(t.toR, t.toC)?.classList.add('valid-target');
    });
  }

  function clearSelection () {
    selectedCell = null;
    validTargets = [];
    unmergeMode = false;
    boardEl?.querySelectorAll('.selected, .valid-target').forEach(el => {
      el.classList.remove('selected', 'valid-target');
    });
    if (defenderBtn) defenderBtn.disabled = true;
    if (attackerBtn) attackerBtn.disabled = true;
    if (unmergeBtn) unmergeBtn.disabled = true;
  }

  function handleDefenderClick () {
    if (!selectedCell) return;
    if (onDefenderCallback) {
      onDefenderCallback(selectedCell.row, selectedCell.col);
    }
    clearSelection();
  }

  function handleAttackerClick () {
    if (!selectedCell) return;
    if (onAttackerCallback) {
      onAttackerCallback(selectedCell.row, selectedCell.col);
    }
    clearSelection();
  }

  function handleUnmergeClick () {
    if (!selectedCell) return;
    // Enter unmerge mode: show unmerge targets
    // We need current state — pass it via a stored reference
    if (_currentState) {
      enterUnmergeMode(_currentState);
    }
  }

  /* ── State reference for unmerge mode ──────────────── */
  let _currentState = null;

  /* ── Helpers ───────────────────────────────────────── */

  function getCellEl (r, c) {
    return boardEl?.querySelector(`[data-row="${r}"][data-col="${c}"]`);
  }

  /* Override render to store state reference */
  function renderWithState (state, localPlayer) {
    _currentState = state;
    renderBoard(state, localPlayer);
    renderHUD(state, localPlayer);
  }

  /* ── Public surface ────────────────────────────────── */
  return { init, render: renderWithState, showMessage, clearMessage, showWinner };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UI;
}
