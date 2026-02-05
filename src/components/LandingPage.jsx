import React, { useState } from 'react';
import AuthForm from './AuthForm';

export default function LandingPage({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState(null); // null, 'login', 'signup'

  return (
    <div className="modern-landing-container">
      
      {/* COLONNA SINISTRA: BRANDING (Desktop) / HEADER (Mobile) */}
      <div className="brand-section">
        <div className="brand-content">
          <h1 className="brand-logo">TeamPlay.</h1>
          <p className="brand-tagline">
            La piattaforma dove il lavoro di squadra incontra il divertimento.
          </p>
        </div>
      </div>

      {/* COLONNA DESTRA: INTERAZIONE */}
      <div className="interaction-section">
        
        {authMode && (
          <button onClick={() => setAuthMode(null)} className="nav-back-btn">
            ← Indietro
          </button>
        )}

        {!authMode ? (
          /* SCELTA INIZIALE */
          <div className="intro-actions">
            <h2 className="intro-title">Benvenuto</h2>
            <p className="intro-text">Accedi al tuo spazio di lavoro o crea un nuovo team.</p>
            
            <div className="action-buttons-grid">
              <button className="big-btn primary" onClick={() => setAuthMode('login')}>
                Accedi al tuo account
              </button>
              <button className="big-btn outline" onClick={() => setAuthMode('signup')}>
                Registrati come nuovo utente
              </button>
            </div>
          </div>
        ) : (
          <AuthForm 
            mode={authMode} 
            onAuth={onLoginSuccess}
            onSwitchMode={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          />
        )}
      </div>
    </div>
  );
}