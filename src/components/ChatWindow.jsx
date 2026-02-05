import React, { useState, useEffect, useRef } from 'react';
import GameWrapper from './GameWrapper';
import { db } from '../firebase';
import { 
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc, updateDoc, deleteDoc, arrayUnion 
} from 'firebase/firestore';
// ICONE
import { Gamepad2, Hash, CircleDot, BrainCircuit, Skull, Check, X, PenTool } from 'lucide-react';

export default function ChatWindow({ currentUser, otherUser, onBack, activeGame, onGameStart, onGameEnd }) {
  const [receiverData, setReceiverData] = useState(otherUser);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showGameMenu, setShowGameMenu] = useState(false);
  
  const messagesEndRef = useRef(null);
  const isFirstLoad = useRef(true);
  
  // Ref per gestire il click fuori dal menu
  const gameMenuRef = useRef(null);

  const chatId = [currentUser.uid, otherUser.uid].sort().join("_");

  const renderAvatar = (user) => {
    if (user.isImage && user.avatar) return <img src={user.avatar} alt="Avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />;
    return user.avatar;
  };

  // Funzione dedicata per avviare invito lavagna
  const handleWhiteboardClick = () => {
      if (window.confirm(`Vuoi aprire una lavagna condivisa con ${receiverData.name}?`)) {
          sendInvite('SharedWhiteboard');
      }
  };

  // --- NUOVA FUNZIONE: Segna come letto ---
  const markAsRead = async () => {
      try {
          const chatRef = doc(db, "chats", chatId);
          // Aggiorniamo solo il campo readBy aggiungendo il nostro ID
          await updateDoc(chatRef, {
              "lastMessage.readBy": arrayUnion(currentUser.uid)
          });
      } catch (e) {
          // Ignoriamo errori silenziosi (es. se l'utente non ha permessi o chat non esiste ancora)
          console.error("Err markAsRead", e);
      }
  };

  // 1. STATO REALTIME UTENTE
  useEffect(() => {
    if (!otherUser?.uid) return;
    const userRef = doc(db, "users", otherUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) setReceiverData(docSnap.data());
    });
    return () => unsubscribe();
  }, [otherUser.uid]);

  // 2. ASCOLTO MESSAGGI
  useEffect(() => {
    isFirstLoad.current = true;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [chatId]);

  // 3. ASCOLTO GIOCO
  useEffect(() => {
    const chatRef = doc(db, "chats", chatId);
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.activeGame) {
          onGameStart(data.activeGame.gameName);
        } else {
          onGameEnd();
        }
      }
    });
    return () => unsubscribe();
  }, [chatId]);

  // Fix Scroll & AUTO-READ
  useEffect(() => {
    if (messagesEndRef.current) {
      const behavior = isFirstLoad.current ? "auto" : "smooth";
      messagesEndRef.current.scrollIntoView({ behavior });
      if (messages.length > 0) isFirstLoad.current = false;
    }

    // SE ARRIVANO MESSAGGI E LA CHAT È APERTA, SEGNA COME LETTO
    if (messages.length > 0) {
        markAsRead();
    }
  }, [messages]);

  // Click Outside Menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (gameMenuRef.current && !gameMenuRef.current.contains(event.target)) {
        setShowGameMenu(false);
      }
    }
    if (showGameMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showGameMenu]);


  // --- HELPER PER ICONE GIOCHI ---
  const getGameIcon = (name) => {
    if (name === 'TicTacToe') return <Hash size={18} />;
    if (name === 'ConnectFour') return <CircleDot size={18} />;
    if (name === 'MemoryGame') return <BrainCircuit size={18} />;
    if (name === 'Hangman') return <Skull size={18} />;
    if (name === 'SharedWhiteboard') return <PenTool size={18} />;
    return <Gamepad2 size={18} />;
  }

  // --- ACTIONS ---
  const updateChatDoc = async (lastMsgText) => {
    const chatRef = doc(db, "chats", chatId);
    await setDoc(chatRef, {
      participantsIds: [currentUser.uid, otherUser.uid],
      participantsData: [
        { 
          uid: currentUser.uid, 
          name: currentUser.name, 
          avatar: currentUser.avatar, 
          isImage: currentUser.isImage || false 
        },
        { 
          uid: otherUser.uid, 
          name: receiverData.name, 
          avatar: receiverData.avatar, 
          isImage: receiverData.isImage || false 
        }
      ],
      lastMessage: { text: lastMsgText, senderId: currentUser.uid, readBy: [currentUser.uid] },
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  const isDeleted = receiverData.status === 'deleted';

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isDeleted) return; 
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await addDoc(collection(db, "chats", chatId, "messages"), { text, senderId: currentUser.uid, createdAt: serverTimestamp(), type: 'text' });
    await updateChatDoc(text);
  };

  const handleInviteClick = (gameName) => {
    setShowGameMenu(false);
    let prettyName = gameName;
    if (gameName === 'TicTacToe') prettyName = 'Tris';
    if (gameName === 'ConnectFour') prettyName = 'Forza 4';
    if (gameName === 'MemoryGame') prettyName = 'Memory';
    if (gameName === 'Hangman') prettyName = 'Impiccato';

    if (window.confirm(`Vuoi invitare ${receiverData.name} a giocare a ${prettyName}?`)) sendInvite(gameName);
  };

  const sendInvite = async (gameName) => {
    let inviteText = `🎮 Invito al gioco`;
    if (gameName === 'SharedWhiteboard') inviteText = `✏️ Invito alla lavagna`;

    await addDoc(collection(db, "chats", chatId, "messages"), { text: inviteText, senderId: currentUser.uid, createdAt: serverTimestamp(), type: 'invite', gameName, status: 'pending' });
    await updateChatDoc(inviteText);
  };

  const handleAcceptInvite = async (messageId, gameName) => {
    // 1. CANCELLA INVITO DAL DB
    await deleteDoc(doc(db, "chats", chatId, "messages", messageId));

    // 2. MESSAGGIO LOCALE
    let startMsgText = "🎮 Partita avviata";
    if (gameName === 'SharedWhiteboard') startMsgText = "✏️ Lavagna avviata";
    
    setMessages(prev => [...prev, { 
        id: 'temp-sys-' + Date.now(), 
        text: startMsgText, 
        senderId: 'system', 
        createdAt: { toMillis: () => Date.now() }, 
        type: 'system' 
    }]);

    // 3. INIZIALIZZA GIOCO
    const chatRef = doc(db, "chats", chatId);
    let gameData = {};
    
    if (gameName === 'SharedWhiteboard') {
        gameData = {
            gameName,
            status: 'active',
            startedAt: serverTimestamp(),
            elements: [], 
            notes: [],    
            turn: null,   
            winner: null,
            players: { [currentUser.uid]: 'PLAYER_1', [otherUser.uid]: 'PLAYER_2' }
        };
    } else if (gameName === 'Hangman') {
        gameData = {
            gameName,
            status: 'setup',
            startedAt: serverTimestamp(),
            word: '',
            guessed: [],
            setter: currentUser.uid, 
            turn: currentUser.uid,   
            winner: null,
            players: { [currentUser.uid]: 'PLAYER_1', [otherUser.uid]: 'PLAYER_2' }
        };
    } else {
        let initialBoard;
        if (gameName === 'TicTacToe') initialBoard = Array(9).fill(null);
        else if (gameName === 'ConnectFour') initialBoard = Array(42).fill(null);
        else if (gameName === 'MemoryGame') {
            const EMOJIS = ['🍕', '🚀', '🐱', '🌵', '🎈', '💎', '🔥', '🎉'];
            initialBoard = [...EMOJIS, ...EMOJIS]
                .sort(() => Math.random() - 0.5)
                .map((icon, index) => ({ id: index, icon, isFlipped: false, isMatched: false, matchedBy: null }));
        }

        gameData = {
            gameName, 
            status: 'active', 
            startedAt: serverTimestamp(), 
            board: initialBoard, 
            turn: currentUser.uid, 
            winner: null, 
            players: { [currentUser.uid]: 'PLAYER_1', [otherUser.uid]: 'PLAYER_2' } 
        };
    }

    await updateDoc(chatRef, { activeGame: gameData });
  };

  const handleDeclineInvite = async (messageId) => {
    // CANCELLA INVITO DAL DB
    await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
  };

  const handleExitGame = async (force = false) => {
    if (force) {
        await updateDoc(doc(db, "chats", chatId), { activeGame: null }).catch(()=>{}); 
    } else {
        if (window.confirm("Se esci, la partita terminerà per entrambi. Confermi?")) {
            await updateDoc(doc(db, "chats", chatId), { activeGame: null }); 
        }
    }
  };

  return (
    // AGGIUNTO: onClick/onKeyDown su tutto il container per intercettare interazioni e segnare come letto
    <div 
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
        onClick={markAsRead}
        onKeyDown={markAsRead}
    >
      <div className="chat-header">
        <div className="chat-header-left">
          <button onClick={onBack} className="chat-back-btn" title="Chiudi chat">←</button>
          
          <div className="avatar-container">
            <div className="avatar" style={{overflow:'hidden'}}>{renderAvatar(receiverData)}</div>
            {!isDeleted && <div className={`status-badge ${receiverData.status === 'online' ? 'online' : 'offline'}`}></div>}
          </div>
          <div>
            <h3 style={{ textDecoration: isDeleted ? 'line-through' : 'none' }}>{receiverData.name}</h3>
            <div style={{ fontSize: '0.75rem', color: isDeleted ? 'var(--error)' : (receiverData.status === 'online' ? 'var(--success)' : 'var(--text-secondary)'), fontWeight: isDeleted || receiverData.status === 'online' ? 'bold' : 'normal' }}>
                {isDeleted ? 'Account Eliminato' : (receiverData.status === 'online' ? 'Online' : 'Offline')}
            </div>
          </div>
        </div>
        
        {!isDeleted && (
            <div className="header-actions" style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
              
              <button 
                className="game-btn secondary" 
                onClick={handleWhiteboardClick} 
                title="Lavagna Condivisa"
                style={{
                    display:'flex', alignItems:'center', justifyContent:'center', 
                    padding: '8px', width: '40px', height: '40px',
                    background:'white', color:'var(--primary)', border:'1px solid var(--primary)', borderRadius: '8px'
                }}
              >
                  <PenTool size={20} />
              </button>

              <div style={{position: 'relative'}} ref={gameMenuRef}>
                  <button 
                    className="game-btn" 
                    onClick={() => setShowGameMenu(!showGameMenu)} 
                    title="Giochi"
                    style={{
                        display:'flex', alignItems:'center', justifyContent:'center', 
                        padding: '8px', width: '40px', height: '40px', borderRadius: '8px'
                    }}
                  >
                      <Gamepad2 size={20} />
                  </button>
                  
                  {showGameMenu && (
                      <div className="games-menu">
                        <div className="game-option" onClick={() => handleInviteClick('TicTacToe')}><Hash size={18} /> Tris</div>
                        <div className="game-option" onClick={() => handleInviteClick('ConnectFour')}><CircleDot size={18} /> Forza 4</div>
                        <div className="game-option" onClick={() => handleInviteClick('MemoryGame')}><BrainCircuit size={18} /> Memory</div>
                        <div className="game-option" onClick={() => handleInviteClick('Hangman')}><Skull size={18} /> Impiccato</div>
                    </div>
                  )}
              </div>
            </div>
        )}
      </div>

      <div className="messages-area">
        {messages.map(m => {
           const isMe = m.senderId === currentUser.uid;
           if (m.type === 'system' || m.senderId === 'system') return <div key={m.id} className="system-message">{m.text}</div>;
           if (m.type === 'invite') {
             let inviteLabel = "";
             if (m.gameName === 'SharedWhiteboard') {
                 inviteLabel = isMe ? 'Hai invitato alla lavagna' : 'Ti invita a collaborare!';
             } else {
                 inviteLabel = isMe ? 'Hai inviato una sfida' : `${receiverData.name} ti sfida!`;
             }

             return (
               <div key={m.id} className={`bubble ${isMe ? 'me' : 'them'}`} style={{background:'transparent', padding:0, boxShadow:'none'}}>
                 <div className="invite-card">
                   <div className="invite-header">
                     <span style={{color:'var(--primary)'}}>{getGameIcon(m.gameName)}</span>
                     <span>{inviteLabel}</span>
                   </div>
                   {m.status === 'pending' ? (
                     <div className="invite-actions">
                       {isMe ? <span className="invite-status">In attesa...</span> : (
                         <>
                           <button className="invite-btn btn-decline" onClick={() => handleDeclineInvite(m.id)} style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'4px'}}>
                                <X size={16} /> No
                           </button>
                           <button className="invite-btn btn-accept" onClick={() => handleAcceptInvite(m.id, m.gameName)} style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'4px'}}>
                                <Check size={16} /> Sì
                           </button>
                         </>
                       )}
                     </div>
                   ) : (
                     <div className="invite-status">{m.status === 'accepted' ? '✅ Accettata' : '❌ Rifiutata'}</div>
                   )}
                 </div>
               </div>
             )
           }
           return <div key={m.id} className={`bubble ${isMe ? 'me' : 'them'}`}>{m.text}</div>
        })}
        <div ref={messagesEndRef} />
      </div>

      {isDeleted ? (
          <div className="chat-input-area" style={{ justifyContent: 'center', color: 'var(--error)', fontStyle: 'italic', background: 'var(--gray-50)', textAlign:'center', fontSize: '0.9rem' }}>
              Non puoi inviare messaggi a questo utente perché l'account è stato eliminato.
          </div>
      ) : (
        <form className="chat-input-area" onSubmit={handleSendMessage}>
            <input type="text" placeholder={`Scrivi a ${receiverData.name}...`} value={inputText} onChange={(e) => setInputText(e.target.value)} />
        </form>
      )}

      {activeGame && <GameWrapper gameName={activeGame} isSolo={false} onExit={handleExitGame} chatId={chatId} currentUser={currentUser} />}
    </div>
  );
}