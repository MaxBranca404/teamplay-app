import React from 'react';
import TicTacToe from '../games/TicTacToe';
import ConnectFour from '../games/ConnectFour';
import MemoryGame from '../games/MemoryGame'; // IMPORTA MEMORY

// AGGIUNGI QUI
const gamesList = { TicTacToe, ConnectFour, MemoryGame };

export default function GameWrapper({ gameName, onExit, isSolo, chatId, currentUser }) {
  const SelectedGame = gamesList[gameName];

  // Helper per titolo carino
  const getTitle = () => {
      if (gameName === 'TicTacToe') return 'Tris';
      if (gameName === 'ConnectFour') return 'Forza 4';
      if (gameName === 'MemoryGame') return 'Memory';
      return gameName;
  }
  
  const getIcon = () => {
      if (gameName === 'TicTacToe') return '🎯';
      if (gameName === 'ConnectFour') return '🔴';
      if (gameName === 'MemoryGame') return '🧠'; // Icona Cervello
      return '🎮';
  }

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'var(--bg-primary)', zIndex: 100, display: 'flex', flexDirection: 'column'
    }}>
      <div style={{
        padding: '16px 24px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>{getIcon()}</span>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
              {getTitle()}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isSolo ? 'Vs CPU' : 'Multiplayer Live'}
            </span>
          </div>
        </div>
        <button onClick={onExit} style={{ background: 'var(--error)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 'bold' }}>
          Termina
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-secondary)', padding: '24px', overflowY: 'auto' }}>
        {SelectedGame ? (
            <SelectedGame isSolo={isSolo} chatId={chatId} currentUser={currentUser} />
        ) : <p>Gioco non trovato</p>}
      </div>
    </div>
  );
}