/**
 * Salt & Pepper – Main entry point
 * ----------------------------------
 * Orchestrates UI, GameLogic, and Network modules.
 */

/* global GameConfig, GameLogic, UI, Network */

(() => {
  'use strict';

  /* ── State ─────────────────────────────────────────── */
  let gameState   = null;
  let localPlayer = null;   // null = local play, 1 or 2 for online
  let isOnline    = false;

  /* ── DOM refs ──────────────────────────────────────── */
  const connPanel   = document.getElementById('connection-panel');
  const gamePanel   = document.getElementById('game-panel');
  const btnHost     = document.getElementById('btn-host');
  const btnJoin     = document.getElementById('btn-join');
  const btnLocal    = document.getElementById('btn-local');
  const btnCopy     = document.getElementById('btn-copy');
  const btnRestart  = document.getElementById('btn-restart');
  const hostInfoDiv = document.getElementById('host-info');
  const myPeerIdEl  = document.getElementById('my-peer-id');
  const remotePeerEl = document.getElementById('remote-peer-id');
  const hostStatus  = document.getElementById('host-status');
  const joinStatus  = document.getElementById('join-status');

  /* ============================================================
     Boot
     ============================================================ */

  UI.init({ onMove: handleMove, onProtector: handleProtector });

  /* ── Connection buttons ────────────────────────────── */

  btnHost.addEventListener('click', () => {
    btnHost.disabled = true;
    Network.host(
      (myId) => {
        hostInfoDiv.classList.remove('hidden');
        myPeerIdEl.value = myId;
        hostStatus.textContent = 'Waiting for opponent…';
      },
      () => {
        hostStatus.textContent = '✅ Opponent connected!';
        localPlayer = GameConfig.PLAYER_1;
        isOnline = true;
        startGame();
      },
      onNetworkData,
    );
  });

  btnJoin.addEventListener('click', () => {
    const remoteId = remotePeerEl.value.trim();
    if (!remoteId) { joinStatus.textContent = 'Please enter a valid ID.'; return; }
    btnJoin.disabled = true;
    joinStatus.textContent = 'Connecting…';

    Network.join(
      remoteId,
      () => {
        joinStatus.textContent = '✅ Connected!';
        localPlayer = GameConfig.PLAYER_2;
        isOnline = true;
        startGame();
      },
      onNetworkData,
    );
  });

  btnLocal.addEventListener('click', () => {
    localPlayer = null;
    isOnline = false;
    startGame();
  });

  btnCopy.addEventListener('click', () => {
    myPeerIdEl.select();
    navigator.clipboard.writeText(myPeerIdEl.value).then(() => {
      btnCopy.textContent = 'Copied!';
      setTimeout(() => { btnCopy.textContent = 'Copy'; }, 1500);
    });
  });

  btnRestart.addEventListener('click', () => {
    if (isOnline) {
      Network.send({ type: 'restart' });
    }
    startGame();
  });

  /* ============================================================
     Game flow
     ============================================================ */

  function startGame () {
    gameState = GameLogic.createInitialState();
    connPanel.classList.add('hidden');
    gamePanel.classList.remove('hidden');
    UI.clearMessage();
    // Remove any leftover winner overlay
    document.querySelectorAll('.winner-overlay').forEach(el => el.remove());
    refreshUI();
  }

  function refreshUI () {
    UI.render(gameState, localPlayer);
  }

  /* ── Moves ─────────────────────────────────────────── */

  function handleMove (fromR, fromC, toR, toC) {
    // Online guard: only allow moves on your turn
    if (isOnline && gameState.currentPlayer !== localPlayer) {
      UI.showMessage("It's not your turn!");
      return;
    }

    const result = GameLogic.executeMove(gameState, fromR, fromC, toR, toC);

    if (!result.success) {
      UI.showMessage(result.reason);
      return;
    }

    gameState = result.state;
    UI.clearMessage();
    refreshUI();

    // Broadcast move to peer
    if (isOnline) {
      Network.send({ type: 'move', fromR, fromC, toR, toC });
    }

    // Win check
    if (gameState.winner) {
      UI.showWinner(gameState.winner);
    }
  }

  /* ── Protector ─────────────────────────────────────── */

  function handleProtector (row, col) {
    if (isOnline && gameState.currentPlayer !== localPlayer) {
      UI.showMessage("It's not your turn!");
      return;
    }

    const result = GameLogic.setProtector(gameState, row, col);
    if (!result.success) {
      UI.showMessage(result.reason);
      return;
    }

    gameState = result.state;
    UI.clearMessage();
    refreshUI();

    if (isOnline) {
      Network.send({ type: 'protector', row, col });
    }
  }

  /* ============================================================
     Network data handler
     ============================================================ */

  function onNetworkData (data) {
    switch (data.type) {
      case 'move': {
        const result = GameLogic.executeMove(gameState, data.fromR, data.fromC, data.toR, data.toC);
        if (result.success) {
          gameState = result.state;
          refreshUI();
          if (gameState.winner) UI.showWinner(gameState.winner);
        }
        break;
      }

      case 'protector': {
        const result = GameLogic.setProtector(gameState, data.row, data.col);
        if (result.success) {
          gameState = result.state;
          refreshUI();
        }
        break;
      }

      case 'restart':
        startGame();
        break;

      default:
        console.warn('[Main] Unknown network message:', data);
    }
  }
})();
