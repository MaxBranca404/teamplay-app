import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

export default function ConnectFour({ isSolo, chatId, currentUser }) {
  const ROWS = 6; const COLS = 7;
  
  // Local (Solo)
  const [localBoard, setLocalBoard] = useState(Array(ROWS * COLS).fill(null));
  const [localRedNext, setLocalRedNext] = useState(true);
  const [localWinner, setLocalWinner] = useState(null);
  // Pareggio locale: se non c'è vincitore e nessuna cella è null
  const localDraw = !localWinner && localBoard.every(c => c !== null);

  // Remote (Multi)
  const [remoteGame, setRemoteGame] = useState(null);

  // --- LOGICA SOLO ---
  useEffect(() => {
    if (isSolo && !localRedNext && !localWinner && !localDraw) {
      const timer = setTimeout(() => {
        const availableCols = [];
        // Controlla solo la prima riga per vedere se la colonna è piena
        for (let c = 0; c < COLS; c++) {
            if (!localBoard[c]) availableCols.push(c);
        }
        
        if (availableCols.length > 0) {
            handleLocalDrop(availableCols[Math.floor(Math.random() * availableCols.length)]);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [localRedNext, localBoard, localWinner, localDraw, isSolo]);

  const handleLocalDrop = (col) => {
    if (localWinner || localDraw || localBoard[col]) return;
    const newBoard = [...localBoard];
    let rowPlaced = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!newBoard[r * COLS + col]) {
        newBoard[r * COLS + col] = localRedNext ? 'R' : 'Y';
        rowPlaced = r; break;
      }
    }
    if (rowPlaced !== -1) {
      setLocalBoard(newBoard);
      if (checkWin(newBoard, rowPlaced, col, localRedNext ? 'R' : 'Y')) {
          setLocalWinner(localRedNext ? 'R' : 'Y');
      } else {
          setLocalRedNext(!localRedNext);
      }
    }
  };

  // --- LOGICA MULTIPLAYER ---
  useEffect(() => {
    if (isSolo || !chatId) return;
    const unsubscribe = onSnapshot(doc(db, "chats", chatId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().activeGame) setRemoteGame(docSnap.data().activeGame);
    });
    return () => unsubscribe();
  }, [chatId, isSolo]);

  const handleRemoteDrop = async (col) => {
    if (!remoteGame || remoteGame.winner || remoteGame.board[col]) return;
    if (remoteGame.turn !== currentUser.uid) return;

    // Player 1 = Red, Player 2 = Yellow
    const myRole = remoteGame.players[currentUser.uid];
    const symbol = myRole === 'PLAYER_1' ? 'R' : 'Y';

    const newBoard = [...remoteGame.board];
    let rowPlaced = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!newBoard[r * COLS + col]) {
        newBoard[r * COLS + col] = symbol;
        rowPlaced = r; break;
      }
    }

    if (rowPlaced !== -1) {
      const win = checkWin(newBoard, rowPlaced, col, symbol);
      const isDraw = !win && newBoard.every(c => c !== null);

      const otherPlayerId = Object.keys(remoteGame.players).find(uid => uid !== currentUser.uid);

      await updateDoc(doc(db, "chats", chatId), {
        "activeGame.board": newBoard,
        "activeGame.turn": (win || isDraw) ? null : otherPlayerId,
        "activeGame.winner": win ? symbol : (isDraw ? 'DRAW' : null)
      });
    }
  };

  const handleRematch = async () => {
    if (isSolo) {
        setLocalBoard(Array(ROWS * COLS).fill(null));
        setLocalWinner(null);
        setLocalRedNext(true);
    } else {
        const initialBoard = Array(ROWS * COLS).fill(null);
        await updateDoc(doc(db, "chats", chatId), {
            "activeGame.board": initialBoard,
            "activeGame.winner": null,
            "activeGame.turn": currentUser.uid 
        });
    }
  };

  // --- RENDER ---
  const board = isSolo ? localBoard : (remoteGame?.board || Array(42).fill(null));
  
  let winner = null;
  let isDraw = false;

  if (isSolo) {
      winner = localWinner;
      isDraw = localDraw;
  } else if (remoteGame) {
      if (remoteGame.winner === 'DRAW') isDraw = true;
      else winner = remoteGame.winner;
  }
  
  let statusMsg = "";
  if (isSolo) {
      if (winner) statusMsg = `Vince: ${winner === 'R' ? 'Rosso' : 'Giallo'}`;
      else if (isDraw) statusMsg = "Pareggio!";
      else statusMsg = `Turno: ${localRedNext ? 'Rosso' : 'Giallo'}`;
  } else if (remoteGame) {
     const mySymbol = remoteGame.players[currentUser.uid] === 'PLAYER_1' ? 'R' : 'Y';
     if (winner) statusMsg = winner === mySymbol ? "HAI VINTO! 🎉" : "Hai perso...";
     else if (isDraw) statusMsg = "Pareggio! 🤝";
     else statusMsg = remoteGame.turn === currentUser.uid ? "Tocca a TE" : "Attendi l'avversario...";
  }

  return (
    <div style={{ textAlign: 'center', maxWidth: '350px', width: '100%' }}>
      <h3 style={{marginBottom:'10px', color: 'var(--gray-700)'}}>{isSolo ? 'Vs CPU' : 'Multiplayer'}</h3>
      
      <div style={{ marginBottom: '10px', fontWeight: 'bold', color: winner ? 'var(--success)' : '#555' }}>
        {statusMsg}
      </div>

      <div style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${COLS}, 1fr)`, 
          gap: '6px', 
          background: '#3b82f6', 
          padding: '10px', 
          borderRadius: '12px',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)'
      }}>
        {board.map((cell, i) => (
          <div key={i} 
            onClick={() => isSolo ? handleLocalDrop(i % COLS) : handleRemoteDrop(i % COLS)}
            style={{ 
              width: '100%', 
              aspectRatio: '1/1', 
              borderRadius: '50%', 
              background: cell === 'R' ? '#ef4444' : cell === 'Y' ? '#f59e0b' : '#ffffff',
              boxShadow: cell ? 'inset 0 -3px 5px rgba(0,0,0,0.2)' : 'inset 0 2px 5px rgba(0,0,0,0.1)',
              cursor: (!winner && !isDraw && (isSolo || remoteGame?.turn === currentUser.uid)) ? 'pointer' : 'default',
              transition: 'background 0.2s'
            }} 
          />
        ))}
      </div>

       {/* Pulsante Reset/Rematch */}
       {(winner || isDraw) && (
          <button 
            onClick={handleRematch} 
            className="game-btn" 
            style={{ marginTop: '20px', width: '100%', padding: '12px' }}
          >
            {isSolo ? 'Ricomincia' : 'Gioca Ancora'}
          </button>
      )}
    </div>
  );
}

// Algoritmo Win
const checkWin = (currentBoard, r, c, player) => {
    const ROWS = 6; const COLS = 7;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let [dr, dc] of directions) {
      let count = 1;
      for (let i = 1; i < 4; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && currentBoard[nr * COLS + nc] === player) count++; else break;
      }
      for (let i = 1; i < 4; i++) {
        const nr = r - dr * i, nc = c - dc * i;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && currentBoard[nr * COLS + nc] === player) count++; else break;
      }
      if (count >= 4) return true;
    }
    return false;
};