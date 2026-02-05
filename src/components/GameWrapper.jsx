import React from 'react';
import TicTacToe from '../games/TicTacToe';
import ConnectFour from '../games/ConnectFour';
import MemoryGame from '../games/MemoryGame';
import Hangman from '../games/Hangman';
import SharedWhiteboard from '../games/SharedWhiteboard';
// IMPORTA ICONE LUCIDE
import { Hash, CircleDot, BrainCircuit, Skull, Gamepad2, X, PenTool } from 'lucide-react';

const gamesList = { TicTacToe, ConnectFour, MemoryGame, Hangman, SharedWhiteboard };

export default function GameWrapper({ gameName, onExit, isSolo, chatId, currentUser }) {
  const SelectedGame = gamesList[gameName];

  const getTitle = () => {
      if (gameName === 'TicTacToe') return 'Tris';
      if (gameName === 'ConnectFour') return 'Forza 4';
      if (gameName === 'MemoryGame') return 'Memory';
      if (gameName === 'Hangman') return 'Impiccato';
      if (gameName === 'SharedWhiteboard') return 'Lavagna Condivisa';
      return gameName;
  }
  
  // Sostituisce le emoji con componenti Icona
  const getIcon = () => {
      if (gameName === 'TicTacToe') return <Hash size={24} />;
      if (gameName === 'ConnectFour') return <CircleDot size={24} />;
      if (gameName === 'MemoryGame') return <BrainCircuit size={24} />;
      if (gameName === 'Hangman') return <Skull size={24} />;
      if (gameName === 'SharedWhiteboard') return <PenTool size={24} />;
      return <Gamepad2 size={24} />;
  }

  // --- RENDER (Se è Whiteboard, nascondiamo l'header standard perché ne ha uno suo interno) ---
  if (gameName === 'SharedWhiteboard') {
      return (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
            {SelectedGame ? (
                <SelectedGame isSolo={isSolo} chatId={chatId} currentUser={currentUser} onExit={onExit} />
            ) : <p>Errore caricamento lavagna</p>}
        </div>
      );
  }
  
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'var(--bg-primary)', zIndex: 100, display: 'flex', flexDirection: 'column'
    }}>
      {/* HEADER GIOCO */}
      <div style={{
        padding: '16px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Icona Colorata */}
          <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
            {getIcon()}
          </span>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
              {getTitle()}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isSolo ? 'Vs CPU' : 'Multiplayer Live'}
            </span>
          </div>
        </div>

        {/* Pulsante EXIT elegante */}
        <button 
            onClick={onExit} 
            title="Chiudi gioco"
            style={{ 
                background: 'transparent', 
                color: 'var(--text-secondary)', 
                border: 'none', 
                cursor: 'pointer', 
                display:'flex', 
                alignItems:'center',
                padding: '4px'
            }}
        >
          <X size={28} />
        </button>
      </div>

      {/* AREA DI GIOCO */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-secondary)', padding: '24px', overflowY: 'auto' }}>
        {SelectedGame ? (
            <SelectedGame isSolo={isSolo} chatId={chatId} currentUser={currentUser} />
        ) : <p>Gioco non trovato</p>}
      </div>
    </div>
  );
}