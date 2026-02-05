import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function ProfilePage({ currentUser }) {
  // Popoliamo gli stati iniziali con i dati attuali
  const [firstName, setFirstName] = useState(currentUser.firstName || currentUser.name.split(' ')[0] || '');
  const [lastName, setLastName] = useState(currentUser.lastName || '');
  const [profileImage, setProfileImage] = useState(currentUser.avatar);
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500000) { alert("Max 500KB"); return; }
      const reader = new FileReader();
      reader.onloadend = () => setProfileImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!firstName || !lastName) { alert("Nome e cognome richiesti"); return; }
    setLoading(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const isImg = profileImage && profileImage.length > 5; // Check base64
      
      await updateDoc(userRef, {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        avatar: profileImage,
        isImage: isImg
      });
      setIsEditing(false);
      alert("Profilo aggiornato!");
    } catch (e) {
      console.error(e);
      alert("Errore salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirm = window.prompt("Scrivi 'ELIMINA' per cancellare il tuo account. Non potrai più accedere.");
    if (confirm === 'ELIMINA') {
      try {
        setLoading(true);
        // Eliminazione logica
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
            status: 'deleted',
            name: 'Utente Eliminato',
            avatar: '❌',
            isImage: false
        });
        await signOut(auth);
      } catch (e) {
        console.error(e);
        alert("Errore durante l'eliminazione.");
        setLoading(false);
      }
    }
  };

  // Helper render
  const renderAvatarPreview = () => {
    const isImg = profileImage && profileImage.length > 5;
    if (isImg || (currentUser.isImage && !isEditing)) {
       return <img src={profileImage} alt="Avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />;
    }
    return profileImage; // Iniziali
  };

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', animation: 'fade-in 0.3s' }}>
      <h2 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Il mio Profilo</h2>

      <div style={{ display: 'flex', gap: '30px', flexDirection: 'row', alignItems: 'flex-start' }}>
        
        {/* AVATAR SECTION */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '100px', height: '100px', borderRadius: '50%', 
            background: 'var(--primary)', color: 'white', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem', overflow: 'hidden', marginBottom: '10px',
            border: '4px solid white', boxShadow: 'var(--shadow-md)'
          }}>
            {renderAvatarPreview()}
          </div>
          {isEditing && (
            <label className="cta-button secondary" style={{ fontSize: '0.8rem', padding: '6px 10px', cursor: 'pointer', color: 'var(--primary)', border: '1px solid var(--border)' }}>
              Cambia
              <input type="file" style={{display:'none'}} onChange={handleImageChange} accept="image/*" />
            </label>
          )}
        </div>

        {/* DATA SECTION */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Email</label>
            <div style={{ padding: '10px', background: 'var(--gray-100)', borderRadius: '6px', color: 'var(--gray-600)' }}>{currentUser.email}</div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nome</label>
              <input 
                className="search-input" 
                value={firstName} 
                onChange={e => setFirstName(e.target.value)} 
                disabled={!isEditing}
                style={{ background: isEditing ? 'white' : 'transparent', border: isEditing ? '1px solid var(--primary)' : 'none', paddingLeft: isEditing ? '10px' : '0' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cognome</label>
              <input 
                className="search-input" 
                value={lastName} 
                onChange={e => setLastName(e.target.value)} 
                disabled={!isEditing}
                style={{ background: isEditing ? 'white' : 'transparent', border: isEditing ? '1px solid var(--primary)' : 'none', paddingLeft: isEditing ? '10px' : '0' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            {!isEditing ? (
              <button className="auth-btn" style={{ width: 'auto' }} onClick={() => setIsEditing(true)}>Modifica Profilo</button>
            ) : (
              <>
                <button className="auth-btn" style={{ width: 'auto' }} onClick={handleSave} disabled={loading}>Salva</button>
                <button className="game-btn" onClick={() => { setIsEditing(false); setFirstName(currentUser.firstName); setProfileImage(currentUser.avatar); }}>Annulla</button>
              </>
            )}
          </div>

          {/* DANGER ZONE */}
          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <button 
                onClick={handleDeleteAccount}
                style={{ background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
                Elimina Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}