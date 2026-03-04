/**
 * Salt & Pepper – PeerJS Networking
 * Copyright (c) 2026 Ben Dov Bloch and Ori Braverman
 * -----------------------------------
 * Wraps PeerJS to provide a simple API:
 *   Network.host(onReady, onConnect, onData)
 *   Network.join(remoteId, onConnect, onData)
 *   Network.send(data)
 *
 * Messages are JSON objects with a `type` field.
 */

/* global Peer */

const Network = (() => {
  let peer = null;
  let conn = null;

  /** Create a Peer and return its ID to the caller. */
  function host (onReady, onConnect, onData) {
    peer = new Peer();

    peer.on('open', (id) => {
      if (onReady) onReady(id);
    });

    peer.on('connection', (dataConn) => {
      conn = dataConn;
      _setupConn(onConnect, onData);
    });

    peer.on('error', (err) => {
      console.error('[Network] Host error:', err);
    });
  }

  /** Connect to a host by their peer ID. */
  function join (remoteId, onConnect, onData) {
    peer = new Peer();

    peer.on('open', () => {
      conn = peer.connect(remoteId, { reliable: true });
      _setupConn(onConnect, onData);
    });

    peer.on('error', (err) => {
      console.error('[Network] Join error:', err);
    });
  }

  function send (data) {
    if (conn && conn.open) {
      conn.send(data);
    }
  }

  function _setupConn (onConnect, onData) {
    conn.on('open', () => {
      if (onConnect) onConnect();
    });

    conn.on('data', (data) => {
      if (onData) onData(data);
    });

    conn.on('close', () => {
      console.log('[Network] Connection closed');
    });

    conn.on('error', (err) => {
      console.error('[Network] Connection error:', err);
    });
  }

  return { host, join, send };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Network;
}
