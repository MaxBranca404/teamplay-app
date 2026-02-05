import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

const DICTIONARY = [
  'CASA', 'ALBERO', 'COMPUTER', 'GATTO', 'MARE', 'PIZZA', 'MONTAGNA', 'SOLE', 
  'AMORE', 'LIBRO', 'MUSICA', 'VIAGGIO', 'SOGNO', 'FIORE', 'NOTTE', 'STELLA',
  'TRENO', 'AEREO', 'CHITARRA', 'CALCIO', 'SCUOLA', 'LAVORO', 'AMICO'
];
const MAX_ERRORS = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

export default function Hangman({ isSolo, chatId, currentUser }) {
  // --- STATI LOCALI (Solo Mode) ---
  const [localWord, setLocalWord] = useState('');
  const [localGuessed, setLocalGuessed] = useState([]);
  const [localStatus, setLocalStatus] = useState('playing'); // playing, won, lost

  // --- STATI MULTIPLAYER ---
  const [remoteGame, setRemoteGame] = useState(null);
  
  // Stato per l'input della parola in multiplayer
  const [inputWord, setInputWord] = useState('');

  // --- INIT SOLO MODE ---
  useEffect(() => {
    if (isSolo && !localWord) {
      initSoloGame();
    }
  }, [isSolo]);

  const initSoloGame = () => {
    const randomWord = DICTIONARY[Math.floor(Math.random() * DICTIONARY.length)];
    setLocalWord(randomWord);
    setLocalGuessed([]);
    setLocalStatus('playing');
  };

  // --- SYNC MULTIPLAYER ---
  useEffect(() => {
    if (isSolo || !chatId) return;
    const unsubscribe = onSnapshot(doc(db, "chats", chatId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().activeGame) {
        setRemoteGame(docSnap.data().activeGame);
      }
    });
    return () => unsubscribe();
  }, [chatId, isSolo]);


  // --- LOGICA DI GIOCO ---

  const handleGuess = async (letter) => {
    if (isSolo) {
      if (localStatus !== 'playing' || localGuessed.includes(letter)) return;
      
      const newGuessed = [...localGuessed, letter];
      setLocalGuessed(newGuessed);

      // Check Win/Loss Locale
      const errors = newGuessed.filter(l => !localWord.includes(l)).length;
      const isWon = localWord.split('').every(char => newGuessed.includes(char));
      
      if (isWon) setLocalStatus('won');
      else if (errors >= MAX_ERRORS) setLocalStatus('lost');

    } else {
      // Multiplayer Guess
      if (!remoteGame || remoteGame.status !== 'playing') return;
      if (remoteGame.turn !== currentUser.uid) return; // Tocca a chi indovina
      if (remoteGame.guessed.includes(letter)) return;

      const newGuessed = [...remoteGame.guessed, letter];
      
      // Calcolo vittoria/sconfitta
      const errors = newGuessed.filter(l => !remoteGame.word.includes(l)).length;
      const isWon = remoteGame.word.split('').every(char => newGuessed.includes(char));
      
      let newStatus = 'playing';
      let winner = null;
      let newTurn = remoteGame.turn; 

      if (isWon) {
          newStatus = 'finished';
          winner = remoteGame.turn; // Vince chi ha indovinato
          newTurn = null;
      } else if (errors >= MAX_ERRORS) {
          newStatus = 'finished';
          // Vince chi ha settato la parola (l'altro player)
          const setterId = Object.keys(remoteGame.players).find(uid => uid !== remoteGame.turn);
          winner = setterId;
          newTurn = null;
      }

      await updateDoc(doc(db, "chats", chatId), {
        "activeGame.guessed": newGuessed,
        "activeGame.status": newStatus,
        "activeGame.winner": winner,
        "activeGame.turn": newTurn
      });
    }
  };

  const handleSetWord = async (e) => {
    e.preventDefault();
    if (!inputWord || inputWord.length < 3) return alert("Minimo 3 lettere");
    if (!/^[a-zA-Z]+$/.test(inputWord)) return alert("Solo lettere");

    const cleanWord = inputWord.toUpperCase();
    const otherPlayerId = Object.keys(remoteGame.players).find(uid => uid !== currentUser.uid);

    await updateDoc(doc(db, "chats", chatId), {
        "activeGame.word": cleanWord,
        "activeGame.status": 'playing',
        "activeGame.turn": otherPlayerId, 
        "activeGame.setter": currentUser.uid, 
        "activeGame.guessed": []
    });
  };

  const handleRematch = async () => {
    if (isSolo) { initSoloGame(); return; }
    
    // In multiplayer, scambiamo i ruoli
    const currentSetter = remoteGame.setter;
    const nextSetter = Object.keys(remoteGame.players).find(uid => uid !== currentSetter);

    await updateDoc(doc(db, "chats", chatId), {
        "activeGame.status": 'setup',
        "activeGame.word": '',
        "activeGame.guessed": [],
        "activeGame.winner": null,
        "activeGame.turn": nextSetter, 
        "activeGame.setter": null
    });
    setInputWord('');
  };

  // --- FIX CRASH: LOADING STATE ---
  // Se siamo in multiplayer e i dati non sono ancora arrivati, mostriamo un loader
  if (!isSolo && !remoteGame) {
      return <div style={{padding: '20px', color: '#666'}}>Caricamento partita...</div>;
  }

  // --- RENDER HELPERS ---
  const currentWord = isSolo ? localWord : (remoteGame?.word || '');
  const currentGuessed = isSolo ? localGuessed : (remoteGame?.guessed || []);
  const errorsCount = currentGuessed.filter(l => !currentWord.includes(l)).length;
  
  // Status Display
  let mainMessage = "";
  if (isSolo) {
      if (localStatus === 'won') mainMessage = "HAI VINTO! 🎉";
      else if (localStatus === 'lost') mainMessage = `PERSO! Era: ${localWord}`;
      else mainMessage = "Indovina la parola";
  } else if (remoteGame) {
      if (remoteGame.status === 'setup') {
          mainMessage = remoteGame.turn === currentUser.uid 
            ? "Tocca a te scegliere la parola!" 
            : "L'avversario sta scegliendo la parola...";
      } else if (remoteGame.status === 'finished') {
          if (remoteGame.winner === currentUser.uid) mainMessage = "HAI VINTO! 🏆";
          else mainMessage = `HAI PERSO... Era: ${remoteGame.word}`;
      } else {
          mainMessage = remoteGame.turn === currentUser.uid 
            ? "Tocca a te indovinare!" 
            : "L'avversario sta indovinando...";
      }
  }

  // Se siamo in Setup Mode (Multiplayer)
  if (!isSolo && remoteGame && remoteGame.status === 'setup') {
      if (remoteGame.turn === currentUser.uid) {
          return (
              <div style={{textAlign: 'center', width: '100%', maxWidth: '300px'}}>
                  <h3>L'Impiccato</h3>
                  <p style={{marginBottom: '20px'}}>Scegli una parola per il tuo avversario</p>
                  <form onSubmit={handleSetWord}>
                      <input 
                        type="text" 
                        value={inputWord}
                        onChange={e => setInputWord(e.target.value.toUpperCase())}
                        maxLength={12}
                        placeholder="Parola segreta..."
                        style={{
                            padding: '10px', fontSize: '1.2rem', width: '100%', 
                            textAlign: 'center', letterSpacing: '5px', textTransform: 'uppercase',
                            marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc'
                        }}
                      />
                      <button type="submit" className="game-btn" style={{width: '100%', padding: '12px'}}>
                          Inizia Partita
                      </button>
                  </form>
              </div>
          );
      } else {
          return (
              <div style={{textAlign: 'center', padding: '40px'}}>
                  <h3>L'Impiccato</h3>
                  <div style={{fontSize: '3rem', margin: '20px 0'}}>🤫</div>
                  <p>L'avversario sta scrivendo la parola...</p>
              </div>
          )
      }
  }

  // --- RENDER GAME BOARD ---
  const isGameOver = isSolo ? (localStatus !== 'playing') : (remoteGame?.status === 'finished');

  return (
    <div style={{ textAlign: 'center', width: '100%', maxWidth: '350px' }}>
      <h3 style={{marginBottom:'5px', color: 'var(--gray-700)'}}>L'Impiccato</h3>
      <div style={{ marginBottom: '10px', fontWeight: 'bold', color: isGameOver ? 'var(--primary)' : '#555' }}>
        {mainMessage}
      </div>

      {/* DISEGNO IMPICCATO */}
      <HangmanDrawing errors={errorsCount} />

      {/* PAROLA NASCOSTA */}
      <div style={{ margin: '20px 0', fontSize: '2rem', letterSpacing: '8px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
        {currentWord.split('').map((char, i) => (
            <span key={i} style={{ borderBottom: '2px solid #333', display: 'inline-block', minWidth: '20px', lineHeight: '1.5' }}>
                {(currentGuessed.includes(char) || isGameOver) ? char : '\u00A0'} 
            </span>
        ))}
      </div>

      {/* TASTIERA */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '5px' }}>
        {ALPHABET.map(letter => {
            const isSelected = currentGuessed.includes(letter);
            let btnColor = 'white';
            if (isSelected) {
                btnColor = currentWord.includes(letter) ? '#dcfce7' : '#fee2e2'; 
            }
            
            // FIX CRASH: Accesso sicuro a remoteGame?.turn
            const isMyTurn = isSolo || (remoteGame && remoteGame.turn === currentUser.uid);

            return (
                <button
                    key={letter}
                    onClick={() => handleGuess(letter)}
                    disabled={isSelected || isGameOver || !isMyTurn}
                    style={{
                        width: '32px', height: '38px', borderRadius: '4px',
                        border: '1px solid #ccc', background: isSelected ? btnColor : 'white',
                        color: isSelected ? '#888' : '#333', fontWeight: 'bold', cursor: 'pointer',
                        opacity: (isSelected || isGameOver) ? 0.6 : 1
                    }}
                >
                    {letter}
                </button>
            )
        })}
      </div>

      {isGameOver && (
          <button onClick={handleRematch} className="game-btn" style={{ marginTop: '20px', width: '100%', padding: '12px' }}>
            {isSolo ? 'Nuova Parola' : 'Gioca Ancora'}
          </button>
      )}
    </div>
  );
}

// Componente Semplice per il disegno SVG
const HangmanDrawing = ({ errors }) => {
    return (
        <div style={{ height: '120px', position: 'relative', margin: '0 auto', width: '150px' }}>
            <svg height="120" width="150">
                <line x1="10" y1="110" x2="80" y2="110" stroke="black" strokeWidth="3" />
                <line x1="45" y1="110" x2="45" y2="10" stroke="black" strokeWidth="3" />
                <line x1="45" y1="10" x2="100" y2="10" stroke="black" strokeWidth="3" />
                <line x1="100" y1="10" x2="100" y2="30" stroke="black" strokeWidth="3" />

                {errors >= 1 && <circle cx="100" cy="40" r="10" stroke="black" strokeWidth="3" fill="transparent" />} 
                {errors >= 2 && <line x1="100" y1="50" x2="100" y2="80" stroke="black" strokeWidth="3" />} 
                {errors >= 3 && <line x1="100" y1="60" x2="80" y2="50" stroke="black" strokeWidth="3" />} 
                {errors >= 4 && <line x1="100" y1="60" x2="120" y2="50" stroke="black" strokeWidth="3" />} 
                {errors >= 5 && <line x1="100" y1="80" x2="80" y2="100" stroke="black" strokeWidth="3" />} 
                {errors >= 6 && <line x1="100" y1="80" x2="120" y2="100" stroke="black" strokeWidth="3" />} 
            </svg>
        </div>
    );
};