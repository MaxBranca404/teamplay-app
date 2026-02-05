import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function AuthForm({ mode, onAuth, onSwitchMode }) {
  // Stati Comuni
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Stati solo Registrazione
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Rimosso confirmPassword
  const [profileImage, setProfileImage] = useState(null); 

  // Gestione caricamento immagine
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500000) {
        alert("L'immagine è troppo grande (max 500KB).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper per determinare cosa mostrare nel pallino avatar
  const getAvatarContent = () => {
    if (profileImage) {
      return <img src={profileImage} alt="Preview" className="avatar-preview-img" />;
    }
    // Se stiamo digitando nome/cognome, mostriamo le iniziali in tempo reale
    if (firstName || lastName) {
        const initials = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase();
        return <span className="avatar-initials-preview">{initials}</span>;
    }
    // Placeholder default
    return <span style={{fontSize: '2rem', opacity: 0.5}}>📷</span>;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        // --- REGISTRAZIONE ---
        if (!firstName || !lastName) throw new Error("Nome e Cognome sono obbligatori.");
        
        // 1. Crea Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 2. Genera Avatar
        const initials = (firstName[0] + lastName[0]).toUpperCase();
        const finalAvatar = profileImage || initials; 

        // 3. Salva su Firestore
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          firstName: firstName,
          lastName: lastName,
          name: `${firstName} ${lastName}`,
          email: email,
          avatar: finalAvatar,
          isImage: !!profileImage,
          status: 'online',
          createdAt: new Date()
        });

      } else {
        // --- LOGIN ---
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      let msg = err.message;
      if (err.code === 'auth/wrong-password') msg = "Password errata.";
      if (err.code === 'auth/user-not-found') msg = "Utente non trovato.";
      if (err.code === 'auth/email-already-in-use') msg = "Email già in uso.";
      if (err.code === 'auth/weak-password') msg = "Password troppo debole.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modern-auth-container">
      <div className="modern-form-header">
        <h2>{mode === 'login' ? 'Bentornato' : 'Crea Account'}</h2>
        <p>{mode === 'login' ? 'Inserisci le tue credenziali per accedere.' : 'Compila i dati per iniziare.'}</p>
      </div>
      
      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <>
            {/* --- NUOVO UPLOAD FOTO CENTRALE --- */}
            <div className="avatar-upload-centered">
                <label className="avatar-upload-wrapper">
                    <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                    <div className="avatar-preview-circle-large">
                        {getAvatarContent()}
                    </div>
                    <div className="avatar-edit-icon">✏️</div>
                </label>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="modern-input-group" style={{ flex: 1 }}>
                <label className="modern-label">Nome</label>
                <input type="text" className="modern-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="modern-input-group" style={{ flex: 1 }}>
                <label className="modern-label">Cognome</label>
                <input type="text" className="modern-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            {/* Vecchio blocco .compact-upload rimosso da qui */}
          </>
        )}

        <div className="modern-input-group">
          <label className="modern-label">Email</label>
          <input 
            type="email" 
            className="modern-input" 
            placeholder="nome@azienda.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="modern-input-group">
          <label className="modern-label">Password</label>
          <input 
            type="password" 
            className="modern-input" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Attendi...' : (mode === 'login' ? 'Accedi' : 'Crea Account')}
        </button>
      </form>
      
      <div className="switch-auth-link">
        {mode === 'login' ? 'Non hai un account?' : 'Hai già un account?'}
        <span onClick={onSwitchMode}>
          {mode === 'login' ? 'Registrati' : 'Accedi'}
        </span>
      </div>
    </div>
  );
}