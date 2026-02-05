import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

const EMOJIS = ['🍕', '🚀', '🐱', '🌵', '🎈', '💎', '🔥', '🎉']; // 8 coppie

export default function MemoryGame({ isSolo, chatId, currentUser }) {
  // --- STATI ---
  // board: array di oggetti { id, icon, isFlipped, isMatched }
  const [board, setBoard] = useState([]);
  const [turn, setTurn] = useState(null); // UID di chi tocca
  const [scores, setScores] = useState({ p1: 0, p2: 0 }); // p1: human/user, p2: cpu/opponent
  const [flippedCards, setFlippedCards] = useState([]); // Indici delle carte girate temporaneamente
  const [isProcessing, setIsProcessing] = useState(false); // Blocco input durante animazioni
  
  // Stati Multiplayer
  const [remoteGame, setRemoteGame] = useState(null);

  // --- INIT BOARD (Solo Mode) ---
  useEffect(() => {
    if (isSolo && board.length === 0) {
      initializeSoloGame();
    }
  }, [isSolo]);

  const initializeSoloGame = () => {
    const shuffled = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((icon, index) => ({ id: index, icon, isFlipped: false, isMatched: false }));
    setBoard(shuffled);
    setTurn('PLAYER'); // 'PLAYER' o 'CPU'
    setScores({ p1: 0, p2: 0 });
    setFlippedCards([]);
    setIsProcessing(false);
  };

  // --- LOGICA CPU ---
  useEffect(() => {
    // Se non è Solo, non è il turno CPU o stiamo processando un match, esci
    if (!isSolo || turn !== 'CPU' || isProcessing) return;

    // FASE 1: La CPU non ha ancora girato nessuna carta -> Gira la prima
    if (flippedCards.length === 0) {
        const timer = setTimeout(() => {
            const hiddenIndices = board
                .map((card, i) => (!card.isFlipped && !card.isMatched ? i : null))
                .filter(i => i !== null);
            
            if (hiddenIndices.length > 0) {
                const randomIdx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
                handleCardClick(randomIdx, true);
            }
        }, 1000); 
        return () => clearTimeout(timer);
    }

    // FASE 2: La CPU ha girato 1 carta -> Gira la seconda
    if (flippedCards.length === 1) {
        const timer = setTimeout(() => {
            const hiddenIndices = board
                .map((card, i) => (!card.isFlipped && !card.isMatched ? i : null))
                .filter(i => i !== null);
            
            if (hiddenIndices.length > 0) {
                const randomIdx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
                handleCardClick(randomIdx, true);
            }
        }, 800); 
        return () => clearTimeout(timer);
    }

  }, [isSolo, turn, isProcessing, flippedCards, board]);


  // --- LOGICA CLICK (Unificata) ---
  const handleCardClick = (index, isCpu = false) => {
    // Controlli blocchi
    if (isProcessing) return;
    if (isSolo && turn === 'CPU' && !isCpu) return; // Blocca click umano durante turno CPU
    if (board[index].isFlipped || board[index].isMatched) return;

    // Se è Multiplayer, controlla turno
    if (!isSolo) {
        if (!remoteGame || remoteGame.turn !== currentUser.uid) return;
        handleRemoteClick(index);
        return;
    }

    // --- LOGICA LOCALE (SOLO) ---
    const newBoard = [...board];
    newBoard[index].isFlipped = true;
    setBoard(newBoard);

    const newFlipped = [...flippedCards, index];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setIsProcessing(true);
      checkForMatch(newFlipped, newBoard);
    }
  };

  const checkForMatch = (currentFlipped, currentBoard) => {
    const [idx1, idx2] = currentFlipped;
    const match = currentBoard[idx1].icon === currentBoard[idx2].icon;

    setTimeout(() => {
      const nextBoard = [...currentBoard];
      
      if (match) {
        nextBoard[idx1].isMatched = true;
        nextBoard[idx2].isMatched = true;
        // Aggiorna punteggio
        setScores(prev => ({
          ...prev,
          [turn === 'PLAYER' ? 'p1' : 'p2']: prev[turn === 'PLAYER' ? 'p1' : 'p2'] + 1
        }));
        // Chi indovina rigioca? Facciamo di no per bilanciare, o sì classico.
        // Classico: Rigioca. Qui: Swap turno per dinamicità.
        setTurn(turn === 'PLAYER' ? 'CPU' : 'PLAYER'); 
      } else {
        nextBoard[idx1].isFlipped = false;
        nextBoard[idx2].isFlipped = false;
        setTurn(turn === 'PLAYER' ? 'CPU' : 'PLAYER');
      }

      setBoard(nextBoard);
      setFlippedCards([]);
      setIsProcessing(false);
    }, 1000);
  };


  // --- LOGICA MULTIPLAYER (Sync) ---
  useEffect(() => {
    if (isSolo || !chatId) return;
    const unsubscribe = onSnapshot(doc(db, "chats", chatId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().activeGame) {
        const data = docSnap.data().activeGame;
        setRemoteGame(data);
        setBoard(data.board);
        // Calcola punteggi live
        const p1Score = data.board.filter(c => c.isMatched && c.matchedBy === data.players[currentUser.uid]).length / 2;
        // Nota: logica punteggio semplificata per UI
      }
    });
    return () => unsubscribe();
  }, [chatId, isSolo]);

  const handleRemoteClick = async (index) => {
    // Questa funzione gestisce il click in multiplayer
    // Nota: La logica completa del match dovrebbe essere lato server o gestita da chi clicca.
    // Qui facciamo una gestione ottimistica: chi clicca aggiorna il DB.
    
    let newBoard = [...remoteGame.board];
    newBoard[index].isFlipped = true;
    
    // Contiamo quante carte sono girate ma non matchate
    const flippedIndices = newBoard
        .map((c, i) => (c.isFlipped && !c.isMatched ? i : null))
        .filter(i => i !== null);

    // 1. Aggiorna DB per mostrare la carta girata
    await updateDoc(doc(db, "chats", chatId), { "activeGame.board": newBoard });

    // 2. Se abbiamo 2 carte girate, controlla match
    if (flippedIndices.length === 2) {
        const [idx1, idx2] = flippedIndices;
        const match = newBoard[idx1].icon === newBoard[idx2].icon;
        
        // Aspetta 1 secondo (simulato nel client che clicca) poi aggiorna DB
        setTimeout(async () => {
            const finalBoard = [...newBoard];
            const myRole = remoteGame.players[currentUser.uid]; // 'PLAYER_1' o 'PLAYER_2'
            const otherPlayerId = Object.keys(remoteGame.players).find(uid => uid !== currentUser.uid);

            if (match) {
                finalBoard[idx1].isMatched = true;
                finalBoard[idx2].isMatched = true;
                finalBoard[idx1].matchedBy = myRole;
                finalBoard[idx2].matchedBy = myRole;
                // Match -> Cambia turno (per bilanciare) o tieni? Facciamo cambio turno.
                 await updateDoc(doc(db, "chats", chatId), { 
                    "activeGame.board": finalBoard,
                    "activeGame.turn": otherPlayerId 
                });
            } else {
                finalBoard[idx1].isFlipped = false;
                finalBoard[idx2].isFlipped = false;
                // No match -> Cambia turno
                await updateDoc(doc(db, "chats", chatId), { 
                    "activeGame.board": finalBoard,
                    "activeGame.turn": otherPlayerId 
                });
            }

            // Check Vittoria
            const allMatched = finalBoard.every(c => c.isMatched);
            if (allMatched) {
                // Conta punti
                const p1Points = finalBoard.filter(c => c.matchedBy === 'PLAYER_1').length;
                const p2Points = finalBoard.filter(c => c.matchedBy === 'PLAYER_2').length;
                let winner = 'DRAW';
                if (p1Points > p2Points) winner = 'PLAYER_1'; // Sarà tradotto in X/O o Nome
                if (p2Points > p1Points) winner = 'PLAYER_2';
                
                await updateDoc(doc(db, "chats", chatId), { "activeGame.winner": winner });
            }

        }, 1000);
    }
  };

  const handleRematch = async () => {
    if (isSolo) { initializeSoloGame(); return; }
    // Init Multiplayer Board
    const shuffled = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((icon, index) => ({ id: index, icon, isFlipped: false, isMatched: false, matchedBy: null }));
    
    await updateDoc(doc(db, "chats", chatId), {
        "activeGame.board": shuffled,
        "activeGame.winner": null,
        "activeGame.turn": currentUser.uid
    });
  };

  // --- RENDER HELPERS ---
  const isGameOver = isSolo ? board.every(c => c.isMatched) : remoteGame?.winner;
  
  // Calcolo Punteggi UI
  let scoreText = "";
  if (isSolo) {
      scoreText = `Tu: ${scores.p1} - CPU: ${scores.p2}`;
      if (isGameOver) scoreText = scores.p1 > scores.p2 ? "HAI VINTO! 🏆" : (scores.p1 === scores.p2 ? "PAREGGIO!" : "HAI PERSO...");
  } else if (remoteGame) {
      const myRole = remoteGame.players[currentUser.uid];
      const p1Points = remoteGame.board.filter(c => c.matchedBy === 'PLAYER_1').length / 2;
      const p2Points = remoteGame.board.filter(c => c.matchedBy === 'PLAYER_2').length / 2;
      const myPoints = myRole === 'PLAYER_1' ? p1Points : p2Points;
      const oppPoints = myRole === 'PLAYER_1' ? p2Points : p1Points;
      
      scoreText = `Tu: ${myPoints} - Avv: ${oppPoints}`;
      if (remoteGame.winner) {
          if (remoteGame.winner === 'DRAW') scoreText = "Pareggio!";
          else scoreText = remoteGame.winner === myRole ? "VITTORIA! 🏆" : "Sconfitta...";
      } else {
          scoreText += remoteGame.turn === currentUser.uid ? " (Tocca a te)" : " (Attendi...)";
      }
  }

  return (
    <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
      <h3 style={{marginBottom:'5px', color: 'var(--gray-700)'}}>Memory</h3>
      <div style={{ marginBottom: '15px', fontWeight: 'bold', color: 'var(--primary)' }}>{scoreText}</div>

      <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
          perspective: '1000px' // Per effetto 3D card flip
      }}>
        {board.map((card, i) => (
          <div 
            key={i} 
            onClick={() => handleCardClick(i)}
            style={{ 
                aspectRatio: '1/1', cursor: 'pointer',
                transition: 'transform 0.6s', transformStyle: 'preserve-3d',
                transform: (card.isFlipped || card.isMatched) ? 'rotateY(180deg)' : 'rotateY(0deg)',
                position: 'relative'
            }}
          >
            {/* FRONT (Coperta) */}
            <div style={{
                position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)', fontSize: '1.5rem', color: 'rgba(255,255,255,0.2)'
            }}>
                ?
            </div>
            {/* BACK (Scoperta) */}
            <div style={{
                position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                background: card.isMatched ? '#dcfce7' : 'white', 
                border: card.isMatched ? '2px solid #22c55e' : '2px solid #e0e7ff',
                borderRadius: '8px', transform: 'rotateY(180deg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem'
            }}>
                {card.icon}
            </div>
          </div>
        ))}
      </div>

      {isGameOver && (
          <button onClick={handleRematch} className="game-btn" style={{ marginTop: '20px', width: '100%', padding: '12px' }}>
            {isSolo ? 'Ricomincia' : 'Gioca Ancora'}
          </button>
      )}
    </div>
  );
}