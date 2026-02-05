import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
// ICONE
import { Camera, Trash2, Save, X, Lock, LogOut, User, Mail } from 'lucide-react';

export default function ProfilePage({ currentUser }) {
  // Popoliamo gli stati iniziali con i dati attuali
  const [firstName, setFirstName] = useState(currentUser.firstName || currentUser.name.split(' ')[0] || '');
  const [lastName, setLastName] = useState(currentUser.lastName || '');
  const [profileImage, setProfileImage] = useState(currentUser.avatar); // Se è null/stringa
  
  // Stati Password
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1000000) { alert("Max 1MB"); return; }
      const reader = new FileReader();
      reader.onloadend = () => setProfileImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Funzione per rimuovere l'immagine (tornare alle iniziali)
  const handleRemoveImage = () => {
    setProfileImage(null);
  };

  const handleSave = async () => {
    if (!firstName || !lastName) { alert("Nome e cognome richiesti"); return; }
    
    // Se l'utente vuole cambiare password, serve quella attuale
    if (newPassword && !currentPassword) {
        alert("Per cambiare la password devi inserire la password attuale per sicurezza.");
        return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;

      // 1. CAMBIO PASSWORD (Se richiesto)
      if (newPassword) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        // Verifica la vecchia password
        await reauthenticateWithCredential(user, credential);
        // Aggiorna con la nuova
        await updatePassword(user, newPassword);
      }

      // 2. AGGIORNAMENTO DATI FIRESTORE
      const userRef = doc(db, "users", currentUser.uid);
      
      // Logica Avatar: se profileImage esiste ed è lunga (base64) -> isImage: true
      // Se è null -> isImage: false, avatar: iniziali
      let finalAvatar = profileImage;
      let isImg = false;

      if (profileImage && profileImage.length > 5) {
          isImg = true;
      } else {
          // Se ho rimosso l'immagine, salvo le iniziali
          finalAvatar = (firstName[0] + lastName[0]).toUpperCase();
          isImg = false;
      }
      
      await updateDoc(userRef, {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        avatar: finalAvatar,
        isImage: isImg
      });

      setIsEditing(false);
      setNewPassword('');
      setCurrentPassword('');
      alert("Profilo aggiornato con successo!");

    } catch (e) {
      console.error(e);
      if (e.code === 'auth/wrong-password') {
          alert("La password attuale inserita non è corretta.");
      } else if (e.code === 'auth/weak-password') {
          alert("La nuova password è troppo debole (min 6 caratteri).");
      } else {
          alert("Errore durante il salvataggio: " + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
      setIsEditing(false);
      // Ripristina valori originali
      setFirstName(currentUser.firstName || currentUser.name.split(' ')[0]);
      setLastName(currentUser.lastName || '');
      setProfileImage(currentUser.avatar);
      setNewPassword('');
      setCurrentPassword('');
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
    // Se c'è un'immagine base64 caricata nello stato locale
    if (profileImage && profileImage.length > 10) {
       return <img src={profileImage} alt="Avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />;
    }
    // Se non sto editando e l'utente ha un'immagine salvata
    if (!isEditing && currentUser.isImage && currentUser.avatar) {
        return <img src={currentUser.avatar} alt="Avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />;
    }
    // Altrimenti mostra le iniziali (calcolate live dai campi input)
    const initials = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase();
    return initials;
  };

  return (
    <div style={{ padding: '30px', maxWidth: '600px', margin: '0 auto', animation: 'fade-in 0.3s' }}>
      <h2 style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '15px', display:'flex', alignItems:'center', gap: 10 }}>
        <User size={28} /> Il mio Profilo
      </h2>

      <div style={{ display: 'flex', gap: '30px', flexDirection: 'column' }}> {/* Mobile friendly: column su mobile, ma qui gestiamo il desktop */}
        
        {/* CONTAINER FLEX PER LAYOUT DESKTOP */}
        <div style={{ display: 'flex', gap: '30px', flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            
            {/* AVATAR SECTION */}
            <div style={{ textAlign: 'center', width: '100%', maxWidth: '120px' }}>
            <div style={{ 
                width: '120px', height: '120px', borderRadius: '50%', 
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.5rem', overflow: 'hidden', marginBottom: '15px',
                border: '4px solid white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                position: 'relative'
            }}>
                {renderAvatarPreview()}
            </div>
            
            {isEditing && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    {/* Pulsante Upload */}
                    <label 
                        className="game-btn" 
                        title="Carica foto"
                        style={{ padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '36px', height: '36px' }}
                    >
                        <Camera size={18} />
                        <input type="file" style={{display:'none'}} onChange={handleImageChange} accept="image/*" />
                    </label>

                    {/* Pulsante Rimuovi (mostra solo se c'è un'immagine) */}
                    {profileImage && profileImage.length > 5 && (
                        <button 
                            className="game-btn" 
                            title="Rimuovi foto"
                            onClick={handleRemoveImage}
                            style={{ padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '36px', height: '36px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca' }}
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            )}
            </div>

            {/* DATA SECTION */}
            <div style={{ flex: 1, width: '100%' }}>
            
            {/* Email (Read Only) */}
            <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <Mail size={14} /> Email
                </label>
                <div style={{ padding: '12px', background: 'var(--gray-100)', borderRadius: '8px', color: 'var(--gray-600)', border: '1px solid var(--border)' }}>
                    {currentUser.email}
                </div>
            </div>

            {/* Nome e Cognome */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 5, display: 'block' }}>Nome</label>
                <input 
                    type="text"
                    value={firstName} 
                    onChange={e => setFirstName(e.target.value)} 
                    disabled={!isEditing}
                    style={{ 
                        width: '100%', padding: '12px', borderRadius: '8px',
                        background: isEditing ? 'white' : 'transparent', 
                        border: isEditing ? '1px solid var(--primary)' : '1px solid transparent',
                        fontWeight: isEditing ? 'normal' : 'bold',
                        color: 'var(--text-primary)'
                    }}
                />
                </div>
                <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 5, display: 'block' }}>Cognome</label>
                <input 
                    type="text"
                    value={lastName} 
                    onChange={e => setLastName(e.target.value)} 
                    disabled={!isEditing}
                    style={{ 
                        width: '100%', padding: '12px', borderRadius: '8px',
                        background: isEditing ? 'white' : 'transparent', 
                        border: isEditing ? '1px solid var(--primary)' : '1px solid transparent',
                        fontWeight: isEditing ? 'normal' : 'bold',
                        color: 'var(--text-primary)'
                    }}
                />
                </div>
            </div>

            {/* SEZIONE CAMBIO PASSWORD (Visibile solo in edit) */}
            {isEditing && (
                <div style={{ marginBottom: '20px', padding: '15px', background: '#fff', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--primary)', display:'flex', alignItems:'center', gap: 6 }}>
                        <Lock size={14} /> Modifica Password
                    </h4>
                    
                    <div style={{ marginBottom: '10px' }}>
                        <input 
                            type="password"
                            placeholder="Nuova Password (opzionale)"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                        />
                    </div>

                    {newPassword && (
                        <div style={{ animation: 'fade-in 0.3s' }}>
                            <input 
                                type="password"
                                placeholder="Password Attuale (OBBLIGATORIA per confermare)"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--error)', background: '#fef2f2', fontSize: '0.9rem' }}
                            />
                            <small style={{color: 'var(--error)', marginTop: 4, display: 'block'}}>Inserisci la password attuale per salvare la nuova password.</small>
                        </div>
                    )}
                </div>
            )}

            {/* BUTTONS ROW (Uniform Size) */}
            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                {!isEditing ? (
                <button 
                    onClick={() => setIsEditing(true)}
                    style={{ 
                        width: '100%', padding: '14px', background: 'var(--primary)', color: 'white', 
                        border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 
                    }}
                >
                    Modifica Profilo
                </button>
                ) : (
                <>
                    {/* BOTTONE ANNULLA */}
                    <button 
                        onClick={handleCancel}
                        disabled={loading}
                        style={{ 
                            flex: 1, // Stessa larghezza
                            padding: '14px', background: 'white', color: 'var(--text-secondary)', 
                            border: '1px solid var(--border)', borderRadius: '8px', fontWeight: '600', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 
                        }}
                    >
                        <X size={18} /> Annulla
                    </button>

                    {/* BOTTONE SALVA */}
                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        style={{ 
                            flex: 1, // Stessa larghezza
                            padding: '14px', background: 'var(--primary)', color: 'white', 
                            border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
                            opacity: loading ? 0.7 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 
                        }}
                    >
                        {loading ? 'Salvataggio...' : <><Save size={18} /> Salva</>}
                    </button>
                </>
                )}
            </div>

            {/* DANGER ZONE */}
            {!isEditing && (
                <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <button 
                        onClick={handleDeleteAccount}
                        style={{ 
                            background: 'transparent', color: 'var(--error)', border: 'none', 
                            padding: '10px', cursor: 'pointer', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '0 auto',
                            opacity: 0.8
                        }}
                    >
                        <LogOut size={16} /> Elimina Account definitivamente
                    </button>
                </div>
            )}
            </div>
        </div>
      </div>
    </div>
  );
}