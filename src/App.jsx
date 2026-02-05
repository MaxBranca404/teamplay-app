import React, { useState, useEffect } from 'react';
import './App.css';
import ChatWindow from './components/ChatWindow';
import GameWrapper from './components/GameWrapper';
import LandingPage from './components/LandingPage';
import ProfilePage from './components/ProfilePage';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, getDocs, arrayUnion } from 'firebase/firestore';

// IMPORTA LE ICONE
import { User, MessageCircle, Gamepad2, LogOut, Hash, CircleDot, BrainCircuit, Skull } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  const [activeChat, setActiveChat] = useState(null); 
  const [view, setView] = useState('chat'); // 'chat', 'games', 'profile'
  const [showSidebar, setShowSidebar] = useState(true);
  
  const [myChats, setMyChats] = useState([]); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [searchResults, setSearchResults] = useState([]); 
  
  // Cache completa degli utenti per aggiornamenti real-time
  const [usersCache, setUsersCache] = useState({});

  const [soloGame, setSoloGame] = useState(null);
  const [activeMultiGame, setActiveMultiGame] = useState(null);

  // Helper per renderizzare avatar
  const renderAvatar = (user) => {
    if (!user) return 'U';
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
          if (userData.status === 'deleted') {
              alert("Account eliminato.");
              await signOut(auth);
              return;
          }
          setCurrentUser(userData);

          // RESET VISTA AL LOGIN
          setView('chat'); 
          setActiveChat(null);
          setSoloGame(null);
          setShowSidebar(true);
          
          await updateDoc(docRef, { status: 'online' });
          
          window.addEventListener('beforeunload', () => {
             updateDoc(docRef, { status: 'offline' });
          });
        } else {
          // Fallback
          setCurrentUser({ uid: user.uid, email: user.email, name: 'Utente', avatar: 'U', isImage: false });
          setView('chat');
        }
      } else {
        setCurrentUser(null);
      }
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. ASCOLTO GLOBALE DATI UTENTI (LIVE DATA)
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cache = {};
      snapshot.docs.forEach(doc => {
        cache[doc.data().uid] = doc.data();
      });
      setUsersCache(cache);
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

  // 4. RICERCA
  useEffect(() => {
    const searchUsers = async () => {
        if (searchTerm.trim().length < 2) { setSearchResults([]); return; }
        const q = query(collection(db, "users"));
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
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
      // CASO 1: Lavagna Condivisa Attiva
      // Se è aperta la lavagna, deleghiamo la gestione dell'uscita alla lavagna stessa
      // tramite un evento, così può chiedere di salvare l'immagine.
      if (activeMultiGame && activeMultiGame === 'SharedWhiteboard') {
          const event = new CustomEvent('request-whiteboard-exit', { 
              detail: { callback: actionCallback } 
          });
          window.dispatchEvent(event);
          return;
      }

      // CASO 2: Gioco Classico Attivo (Solo o Multi)
      if (soloGame || activeMultiGame) {
          if (window.confirm("Partita in corso. Vuoi abbandonare?")) {
              
              if (activeMultiGame && activeChat?.chatId) {
                  updateDoc(doc(db, "chats", activeChat.chatId), { activeGame: null })
                    .catch(e => console.error("Errore cleanup partita:", e));
              }

              setSoloGame(null);
              setActiveMultiGame(null);
              actionCallback();
          }
      } else { 
          // CASO 3: Nessuna attività
          actionCallback(); 
      }
  };

  if (loadingUser) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>Caricamento...</div>;
  if (!currentUser) return <LandingPage onLoginSuccess={() => {}} />;

  const isMobileDetail = activeChat || soloGame || view === 'profile';

  return (
    <div className="app-container">
      {/* Sidebar Nav Desktop */}
      <nav className="nav-sidebar">
        <div 
          className={`nav-item ${view === 'profile' ? 'active' : ''}`} 
          onClick={() => safeNavigate(() => {setView('profile'); setShowSidebar(true); setActiveChat(null);})}
          style={{ marginBottom: '20px' }}
        >
          <User size={24} />
        </div>

        <div className={`nav-item ${view === 'chat' ? 'active' : ''}`} onClick={() => safeNavigate(() => {setView('chat'); setShowSidebar(true)})}>
            <MessageCircle size={24} />
        </div>
        <div className={`nav-item ${view === 'games' ? 'active' : ''}`} onClick={() => safeNavigate(() => {setView('games'); setShowSidebar(true)})}>
            <Gamepad2 size={24} />
        </div>
        <div className="nav-item" onClick={handleLogout} style={{ marginTop: 'auto', color: 'var(--error)' }}>
            <LogOut size={24} />
        </div>
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
                        <div className={`status-badge ${(usersCache[user.uid]?.status || user.status) === 'online' ? 'online' : 'offline'}`}></div>
                      </div>
                      <div className="user-info"><div className="user-name">{user.name}</div><div className="user-status">Clicca per chattare</div></div>
                    </div>
                 ))
               ) : (
                 /* LISTA MIE CHAT */
                 myChats.map(chatUser => {
                   const liveUser = usersCache[chatUser.uid];
                   const displayName = liveUser ? liveUser.name : chatUser.name;
                   const displayAvatar = liveUser ? liveUser : chatUser;
                   const liveStatus = liveUser ? (liveUser.status || 'offline') : 'offline';
                   const isDeleted = liveStatus === 'deleted';
                   
                   return (
                      <div key={chatUser.chatId} className={`user-item ${activeChat?.uid === chatUser.uid ? 'active' : ''} ${!chatUser.isRead ? 'unread' : ''}`} onClick={() => handleChatSelect(chatUser)}>
                        <div className="avatar-container">
                          <div className="avatar" style={{overflow:'hidden'}}>{renderAvatar(displayAvatar)}</div>
                          {!isDeleted && <div className={`status-badge ${liveStatus === 'online' ? 'online' : 'offline'}`}></div>}
                        </div>
                        <div className="user-info">
                          <div className="user-name" style={{
                              textDecoration: isDeleted ? 'line-through' : 'none',
                              color: isDeleted ? '#aaa' : 'inherit'
                          }}>
                              {displayName}
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
             <h4 style={{ paddingLeft: '8px', marginBottom: '15px', color:'var(--text-secondary)' }}>Solo Mode</h4>
             
             <div className="user-item" onClick={() => safeNavigate(() => { setActiveChat(null); setSoloGame('TicTacToe'); setShowSidebar(false); })}>
                <Hash size={24} style={{marginRight: 15}} /> Tris
             </div>
             
             <div className="user-item" onClick={() => safeNavigate(() => { setActiveChat(null); setSoloGame('ConnectFour'); setShowSidebar(false); })}>
                <CircleDot size={24} style={{marginRight: 15}} /> Forza 4
             </div>

             <div className="user-item" onClick={() => safeNavigate(() => { setActiveChat(null); setSoloGame('MemoryGame'); setShowSidebar(false); })}>
                <BrainCircuit size={24} style={{marginRight: 15}} /> Memory
             </div>

             <div className="user-item" onClick={() => safeNavigate(() => { setActiveChat(null); setSoloGame('Hangman'); setShowSidebar(false); })}>
                <Skull size={24} style={{marginRight: 15}} /> Impiccato
             </div>
          </div>
        ) : (
          <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>
              Gestione Account
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className={`chat-main ${!isMobileDetail ? 'mobile-hidden' : ''}`}> 
        {view === 'profile' ? (
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
           <div className="empty-state">
             <Gamepad2 size={64} style={{opacity:0.2, marginBottom: 20}} />
             <h3>Scegli un gioco</h3>
           </div>
        ) : view === 'games' && soloGame ? (
           <GameWrapper gameName={soloGame} isSolo={true} onExit={() => safeNavigate(() => setSoloGame(null))} />
        ) : (
           <div className="empty-state">
             <MessageCircle size={64} style={{opacity:0.2, marginBottom: 20}} />
             <h3>Seleziona una chat</h3>
             <p style={{fontSize: '0.9rem', marginTop: '5px'}}>Scegli un contatto dalla barra laterale</p>
           </div>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="mobile-nav">
        <div className="mobile-nav-item" onClick={() => safeNavigate(() => {
            setView('profile'); 
            setShowSidebar(false); 
            setActiveChat(null); 
            setSoloGame(null);
        })}>
             <User size={24} color={view === 'profile' ? '#4f46e5' : '#6b7280'} />
        </div>

        <div className="mobile-nav-item" onClick={() => safeNavigate(() => {
            setView('chat'); 
            setShowSidebar(true); 
            setActiveChat(null); 
            setSoloGame(null);
        })}>
            <MessageCircle size={24} color={view === 'chat' ? '#4f46e5' : '#6b7280'} />
        </div>

        <div className="mobile-nav-item" onClick={() => safeNavigate(() => {
            setView('games'); 
            setShowSidebar(true); 
            setActiveChat(null); 
            setSoloGame(null);
        })}>
            <Gamepad2 size={24} color={view === 'games' ? '#4f46e5' : '#6b7280'} />
        </div>

        <div className="mobile-nav-item" onClick={handleLogout}>
            <LogOut size={24} color="#ef4444" />
        </div>
      </nav>
    </div>
  );
}