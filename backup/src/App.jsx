import React, { useState, useEffect } from 'react';
import './App.css';
import ChatWindow from './components/ChatWindow';
import GameWrapper from './components/GameWrapper';
import LandingPage from './components/LandingPage';
import ProfilePage from './components/ProfilePage'; // IMPORT NUOVO

import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, getDocs, arrayUnion } from 'firebase/firestore';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  const [activeChat, setActiveChat] = useState(null); 
  const [view, setView] = useState('chat'); // 'chat', 'games', 'profile'
  const [showSidebar, setShowSidebar] = useState(true);
  
  const [myChats, setMyChats] = useState([]); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [searchResults, setSearchResults] = useState([]); 
  
  const [usersStatus, setUsersStatus] = useState({});

  const [soloGame, setSoloGame] = useState(null);
  const [activeMultiGame, setActiveMultiGame] = useState(null);

  // Helper per renderizzare avatar (Testo o Immagine)
  const renderAvatar = (user) => {
    if (user.isImage && user.avatar) {
      return <img src={user.avatar} alt="Avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />;
    }
    return user.avatar; 
  };

  // 1. GESTIONE UTENTE LOGGATO
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          // Controllo se è un account eliminato
          if (userData.status === 'deleted') {
              alert("Account eliminato.");
              await signOut(auth);
              return;
          }
          setCurrentUser(userData);
          await updateDoc(docRef, { status: 'online' });
          
          window.addEventListener('beforeunload', () => {
             updateDoc(docRef, { status: 'offline' });
          });
        } else {
          // Fallback per vecchi utenti mock o incompleti
          setCurrentUser({ uid: user.uid, email: user.email, name: 'Utente', avatar: 'U', isImage: false });
        }
      } else {
        setCurrentUser(null);
      }
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. ASCOLTO GLOBALE STATO UTENTI
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const statuses = {};
      snapshot.docs.forEach(doc => {
        statuses[doc.data().uid] = doc.data().status || 'offline';
      });
      setUsersStatus(statuses);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // 3. SCARICARE LE CHAT
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "chats"), where("participantsIds", "array-contains", currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const otherUser = data.participantsData?.find(p => p.uid !== currentUser.uid) || { name: 'Utente', avatar: '?', status: 'offline' };
        const lastMsg = data.lastMessage || null;
        const isRead = lastMsg ? (lastMsg.readBy && lastMsg.readBy.includes(currentUser.uid)) : true; 

        return {
          chatId: doc.id,
          ...otherUser, 
          lastMessageText: lastMsg ? lastMsg.text : '',
          lastMessageTime: data.updatedAt,
          isRead: isRead
        };
      });
      chatsData.sort((a, b) => (b.lastMessageTime?.toMillis() || 0) - (a.lastMessageTime?.toMillis() || 0));
      setMyChats(chatsData);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // 4. RICERCA (Esclude utenti eliminati)
  useEffect(() => {
    const searchUsers = async () => {
        if (searchTerm.trim().length < 2) { setSearchResults([]); return; }
        const q = query(collection(db, "users"));
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            // Filtro: non io, contiene testo, NON eliminato
            if (userData.uid !== currentUser.uid && userData.status !== 'deleted' && userData.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                results.push(userData);
            }
        });
        setSearchResults(results);
    };
    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, currentUser]);


  const handleBackToList = () => {
    safeNavigate(() => {
      // Su mobile l'azione è immediata (nessuna animazione sidebar)
      setShowSidebar(true);
      setActiveChat(null);
    });
  };

  const handleChatSelect = async (chatUser) => {
      safeNavigate(async () => {
          setActiveChat(chatUser);
          setShowSidebar(false);
          if (!chatUser.isRead) {
              const chatRef = doc(db, "chats", chatUser.chatId);
              try { await updateDoc(chatRef, { "lastMessage.readBy": arrayUnion(currentUser.uid) }); } catch (e) {}
          }
      });
  };

  const handleLogout = async () => {
      safeNavigate(async () => {
          if (currentUser) await updateDoc(doc(db, "users", currentUser.uid), { status: 'offline' });
          await signOut(auth);
      });
  };

  const safeNavigate = (actionCallback) => {
      if (soloGame || activeMultiGame) {
          if (window.confirm("Partita in corso. Vuoi abbandonare?")) {
              setSoloGame(null);
              setActiveMultiGame(null);
              actionCallback();
          }
      } else { actionCallback(); }
  };

  if (loadingUser) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>Caricamento...</div>;
  if (!currentUser) return <LandingPage onLoginSuccess={() => {}} />;

  // Logica per Mobile: Siamo in una vista di dettaglio?
  // (Cioè: c'è una chat aperta, un gioco aperto, o siamo sul profilo)
  const isMobileDetail = activeChat || soloGame || view === 'profile';

  return (
    <div className="app-container">
      {/* Sidebar Nav */}
      <nav className="nav-sidebar">
        {/* ICONA PROFILO */}
        <div 
          className={`nav-item ${view === 'profile' ? 'active' : ''}`} 
          onClick={() => safeNavigate(() => {setView('profile'); setShowSidebar(true); setActiveChat(null);})}
          style={{ marginBottom: '20px' }}
        >
          👤
        </div>

        <div className={`nav-item ${view === 'chat' ? 'active' : ''}`} onClick={() => safeNavigate(() => {setView('chat'); setShowSidebar(true)})}>💬</div>
        <div className={`nav-item ${view === 'games' ? 'active' : ''}`} onClick={() => safeNavigate(() => {setView('games'); setShowSidebar(true)})}>🎮</div>
        <div className="nav-item" onClick={handleLogout} style={{ marginTop: 'auto', color: 'var(--error)' }}>🚪</div>
      </nav>

      {/* Sidebar List */}
      <aside className={`user-sidebar ${showSidebar ? 'show' : ''} ${isMobileDetail ? 'mobile-hidden' : ''}`}>
        <div className="sidebar-header"><h2>TeamPlay</h2><span>{currentUser.name}</span></div>

        {view === 'chat' ? (
          <>
             <div className="sidebar-search">
               <input type="text" className="search-input" placeholder="Cerca un collega..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
             <div style={{ flex: 1, overflowY: 'auto' }}>
               {/* RISULTATI RICERCA */}
               {searchTerm.length >= 2 ? (
                 searchResults.map(user => (
                    <div key={user.uid} className="user-item" onClick={() => safeNavigate(() => { setActiveChat(user); setShowSidebar(false); setSearchTerm(''); })}>
                      <div className="avatar-container">
                        <div className="avatar" style={{overflow:'hidden'}}>{renderAvatar(user)}</div>
                        <div className={`status-badge ${(usersStatus[user.uid] || user.status) === 'online' ? 'online' : 'offline'}`}></div>
                      </div>
                      <div className="user-info"><div className="user-name">{user.name}</div><div className="user-status">Clicca per chattare</div></div>
                    </div>
                 ))
               ) : (
                 /* LISTA MIE CHAT */
                 myChats.map(chatUser => {
                   const liveStatus = usersStatus[chatUser.uid] || 'offline';
                   const isDeleted = liveStatus === 'deleted' || chatUser.status === 'deleted';
                   
                   return (
                      <div key={chatUser.chatId} className={`user-item ${activeChat?.uid === chatUser.uid ? 'active' : ''} ${!chatUser.isRead ? 'unread' : ''}`} onClick={() => handleChatSelect(chatUser)}>
                        <div className="avatar-container">
                          <div className="avatar" style={{overflow:'hidden'}}>{renderAvatar(chatUser)}</div>
                          {/* Nascondi status dot se eliminato */}
                          {!isDeleted && <div className={`status-badge ${liveStatus === 'online' ? 'online' : 'offline'}`}></div>}
                        </div>
                        <div className="user-info">
                          <div className="user-name" style={{
                              textDecoration: isDeleted ? 'line-through' : 'none',
                              color: isDeleted ? '#aaa' : 'inherit'
                          }}>
                              {chatUser.name}
                          </div>
                          <div className="user-status" style={{fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px'}}>
                            {chatUser.lastMessageText || <span style={{fontStyle:'italic', opacity:0.7}}>Nessun messaggio</span>}
                          </div>
                        </div>
                        {!chatUser.isRead && <div className="unread-badge"></div>}
                      </div>
                   )
                 })
               )}
             </div>
          </>
        ) : view === 'games' ? (
          <div style={{ padding: '16px' }}>
             <h4 style={{ paddingLeft: '8px', marginBottom: '10px' }}>Solo Mode</h4>
             
             {/* MODIFICA QUI: Aggiunto setActiveChat(null) in tutti i giochi */}
             <div className="user-item" onClick={() => safeNavigate(() => { 
                 setActiveChat(null); // <--- IMPORTANTE: Chiude la chat sotto
                 setSoloGame('TicTacToe'); 
                 setShowSidebar(false); 
             })}>
                <span style={{ fontSize: '24px' }}>🎯</span> Tris
             </div>
             
             <div className="user-item" onClick={() => safeNavigate(() => { 
                 setActiveChat(null); // <--- IMPORTANTE
                 setSoloGame('ConnectFour'); 
                 setShowSidebar(false); 
             })}>
                <span style={{ fontSize: '24px' }}>🔴</span> Forza 4
             </div>

             <div className="user-item" onClick={() => safeNavigate(() => { 
                 setActiveChat(null); // <--- IMPORTANTE
                 setSoloGame('MemoryGame'); 
                 setShowSidebar(false); 
             })}>
                <span style={{ fontSize: '24px' }}>🧠</span> Memory
             </div>
          </div>
        ) : (
          /* VIEW PROFILE SIDEBAR */
          <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>
              Gestione Account
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className={`chat-main ${!isMobileDetail ? 'mobile-hidden' : ''}`}>        {view === 'profile' ? (
             <ProfilePage currentUser={currentUser} />
        ) : activeChat ? (
          <ChatWindow 
            currentUser={currentUser} 
            otherUser={activeChat}    
            onBack={handleBackToList}
            activeGame={activeMultiGame}
            onGameStart={(game) => setActiveMultiGame(game)} 
            onGameEnd={() => setActiveMultiGame(null)}
          />
        ) : view === 'games' && !soloGame ? (
           <div className="empty-state"><div className="empty-state-icon">🎮</div><h3>Scegli un gioco</h3></div>
        ) : view === 'games' && soloGame ? (
           <GameWrapper gameName={soloGame} isSolo={true} onExit={() => safeNavigate(() => setSoloGame(null))} />
        ) : (
           <div className="empty-state">
             <div className="empty-state-icon">💬</div>
             <h3>Seleziona una chat</h3>
             <p style={{fontSize: '0.9rem', marginTop: '5px'}}>Scegli un contatto dalla barra laterale</p>
           </div>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="mobile-nav">
        <div className="mobile-nav-item" onClick={() => safeNavigate(() => {setView('profile'); setShowSidebar(false); setActiveChat(null);})}><div>👤</div></div>
        <div className="mobile-nav-item" onClick={() => safeNavigate(() => {setView('chat'); setShowSidebar(true);})}><div>💬</div></div>
        <div className="mobile-nav-item" onClick={() => safeNavigate(() => {setView('games'); setShowSidebar(true); setSoloGame(null);})}><div>🎮</div></div>
        <div className="mobile-nav-item" onClick={handleLogout}><div style={{color: 'var(--error)'}}>🚪</div></div>
      </nav>
    </div>
  );
}