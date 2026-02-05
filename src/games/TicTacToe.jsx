import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

export default function TicTacToe({ isSolo, chatId, currentUser }) {
  // Stati Locali (Solo Mode)
  const [localBoard, setLocalBoard] = useState(Array(9).fill(null));
  const [localXIsNext, setLocalXIsNext] = useState(true);
  
  // Stati Multiplayer
  const [remoteGame, setRemoteGame] = useState(null);

  // --- 1. LOGICA CPU (Solo Mode) ---
  const winnerLocal = isSolo ? calculateWinner(localBoard) : null;
  // Pareggio se non c'è vincitore e nessuna cella è null
  const isDrawLocal = isSolo && !winnerLocal && localBoard.every(cell => cell !== null);

  useEffect(() => {
    // Se è modalità solo, tocca alla CPU (!localXIsNext), e il gioco è in corso
    if (isSolo && !localXIsNext && !winnerLocal && !isDrawLocal) {
      const timer = setTimeout(() => {
        // La CPU cerca spazi vuoti
        const empties = localBoard
          .map((val, idx) => (val === null ? idx : null))
          .filter((val) => val !== null);

        if (empties.length > 0) {
          const randomMove = empties[Math.floor(Math.random() * empties.length)];
          // La CPU chiama la mossa (senza passare dal click handler)
          handleLocalMove(randomMove);
        }
      }, 600); // Ritardo per effetto "pensiero"
      return () => clearTimeout(timer);
    }
  }, [localXIsNext, isSolo, winnerLocal, isDrawLocal, localBoard]);

  const handleLocalMove = (i) => {
    // Controllo base: cella occupata o gioco finito
    if (localBoard[i] || winnerLocal || isDrawLocal) return;

    // NOTA: Ho rimosso qui il blocco "if (!localXIsNext) return" 
    // perché impediva anche alla CPU di muovere! 
    // Il blocco per l'utente ora è nell'onClick.

    const newBoard = [...localBoard];
    newBoard[i] = localXIsNext ? 'X' : 'O';
    setLocalBoard(newBoard);
    setLocalXIsNext(!localXIsNext);
  };

  // --- 2. LOGICA MULTIPLAYER (Live) ---
  useEffect(() => {
    if (isSolo || !chatId) return;
    const unsubscribe = onSnapshot(doc(db, "chats", chatId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().activeGame) {
        setRemoteGame(docSnap.data().activeGame);
      }
    });
    return () => unsubscribe();
  }, [chatId, isSolo]);

  const handleRemoteMove = async (i) => {
    if (!remoteGame || remoteGame.board[i] || remoteGame.winner) return;
    if (remoteGame.board.every(cell => cell !== null)) return; // Draw check

    if (remoteGame.turn !== currentUser.uid) return;

    const myRole = remoteGame.players[currentUser.uid]; 
    const symbol = myRole === 'PLAYER_1' ? 'X' : 'O';

    const newBoard = [...remoteGame.board];
    newBoard[i] = symbol;

    const win = calculateWinner(newBoard);
    const isDraw = !win && newBoard.every(cell => cell !== null);
    
    const otherPlayerId = Object.keys(remoteGame.players).find(uid => uid !== currentUser.uid);

    await updateDoc(doc(db, "chats", chatId), {
      "activeGame.board": newBoard,
      "activeGame.turn": (win || isDraw) ? null : otherPlayerId,
      "activeGame.winner": win ? symbol : (isDraw ? 'DRAW' : null)
    });
  };

  const handleRematch = async () => {
    if (isSolo) {
        setLocalBoard(Array(9).fill(null)); 
        setLocalXIsNext(true);
    } else {
        const initialBoard = Array(9).fill(null);
        await updateDoc(doc(db, "chats", chatId), {
            "activeGame.board": initialBoard,
            "activeGame.winner": null,
            "activeGame.turn": currentUser.uid 
        });
    }
  };

  // --- RENDER ---
  const board = isSolo ? localBoard : (remoteGame?.board || Array(9).fill(null));
  
  let winner = null;
  let isDraw = false;

  if (isSolo) {
      winner = winnerLocal;
      isDraw = isDrawLocal;
  } else if (remoteGame) {
      if (remoteGame.winner === 'DRAW') isDraw = true;
      else winner = remoteGame.winner;
  }

  let statusMsg = "";
  if (isSolo) {
      if (winner) statusMsg = `Vince: ${winner}`;
      else if (isDraw) statusMsg = "Pareggio!";
      else statusMsg = `Turno: ${localXIsNext ? 'Tu (X)' : 'CPU (O)'}`;
  } else if (remoteGame) {
      if (winner) {
          const mySymbol = remoteGame.players[currentUser.uid] === 'PLAYER_1' ? 'X' : 'O';
          statusMsg = winner === mySymbol ? "HAI VINTO! 🎉" : "Hai perso...";
      } else if (isDraw) {
          statusMsg = "Pareggio! 🤝";
      } else {
          statusMsg = remoteGame.turn === currentUser.uid ? "Tocca a TE" : "Attendi l'avversario...";
      }
  }

  const cellStyle = {
    background: 'white',
    border: '2px solid #e0e7ff',
    borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '2rem', fontWeight: 'bold',
    cursor: 'pointer',
    aspectRatio: '1/1',
    color: 'var(--primary)'
  };

  return (
    <div style={{ textAlign: 'center', width: '100%', maxWidth: '300px' }}>
      <h3 style={{marginBottom:'10px', color: 'var(--gray-700)'}}>{isSolo ? 'Vs CPU' : 'Multiplayer'}</h3>
      
      <div style={{ 
          marginBottom: '15px', fontWeight: 'bold', minHeight:'24px', 
          color: winner ? 'var(--success)' : (isDraw ? 'var(--text-secondary)' : 'var(--primary)') 
      }}>
        {statusMsg}
      </div>

      <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '10px',
          background: 'var(--bg-primary)',
          padding: '10px',
          borderRadius: '12px'
      }}>
        {board.map((val, i) => (
          <div 
            key={i} 
            style={cellStyle} 
            onClick={() => {
                if (isSolo) {
                    // BLOCCO QUI IL CLICK DELL'UTENTE SE TOCCA ALLA CPU
                    if (!localXIsNext) return; 
                    handleLocalMove(i);
                } else {
                    handleRemoteMove(i);
                }
            }}
          >
            {val === 'X' && <span style={{color:'#ef4444'}}>X</span>}
            {val === 'O' && <span style={{color:'#3b82f6'}}>O</span>}
          </div>
        ))}
      </div>

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

function calculateWinner(squares) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (let [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
  }
  return null;
}