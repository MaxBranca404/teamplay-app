import React, { useState, useEffect, useRef } from 'react';
import GameWrapper from './GameWrapper';
import { db } from '../firebase';
import { 
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc, updateDoc, getDoc 
} from 'firebase/firestore';

export default function ChatWindow({ currentUser, otherUser, onBack, activeGame, onGameStart, onGameEnd }) {
  const [receiverData, setReceiverData] = useState(otherUser);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showGameMenu, setShowGameMenu] = useState(false);
  
  const messagesEndRef = useRef(null);
  const isFirstLoad = useRef(true);

  const chatId = [currentUser.uid, otherUser.uid].sort().join("_");

  const renderAvatar = (user) => {
    if (user.isImage && user.avatar) return <img src={user.avatar} alt="Avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />;
    return user.avatar;
  };

  // 1. STATO REALTIME
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
        if (data.activeGame && data.activeGame.status === 'active') {
          onGameStart(data.activeGame.gameName);
        } else {
          onGameEnd();
        }
      }
    });
    return () => unsubscribe();
  }, [chatId]);

  // Fix Scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      const behavior = isFirstLoad.current ? "auto" : "smooth";
      messagesEndRef.current.scrollIntoView({ behavior });
      if (messages.length > 0) isFirstLoad.current = false;
    }
  }, [messages]);

  // --- ACTIONS ---

  const updateChatDoc = async (lastMsgText) => {
    const chatRef = doc(db, "chats", chatId);
    // FIX: Aggiunti fallback '|| false' per isImage. Se undefined, setDoc crasha o non aggiorna.
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
    if (window.confirm(`Vuoi invitare ${receiverData.name} a giocare a ${gameName}?`)) sendInvite(gameName);
  };

  const sendInvite = async (gameName) => {
    const prettyName = gameName === 'TicTacToe' ? 'Tris' : (gameName === 'ConnectFour' ? 'Forza 4' : 'Memory');
    const inviteText = `🎮 Invito a giocare a ${prettyName}`;
    await addDoc(collection(db, "chats", chatId, "messages"), { text: inviteText, senderId: currentUser.uid, createdAt: serverTimestamp(), type: 'invite', gameName, status: 'pending' });
    await updateChatDoc(inviteText);
  };

  const handleAcceptInvite = async (messageId, gameName) => {
    const msgRef = doc(db, "chats", chatId, "messages", messageId);
    await updateDoc(msgRef, { status: 'accepted' });

    // Nome leggibile
    const prettyName = gameName === 'TicTacToe' ? 'Tris' : (gameName === 'ConnectFour' ? 'Forza 4' : 'Memory');
    const startMsgText = `🎮 Partita di ${prettyName} iniziata!`;
    
    await addDoc(collection(db, "chats", chatId, "messages"), { text: startMsgText, senderId: 'system', createdAt: serverTimestamp(), type: 'system' });
    await updateChatDoc(startMsgText);

    const chatRef = doc(db, "chats", chatId);
    
    // --- INIT BOARD DIFFERENZIATA ---
    let initialBoard;
    let turn = currentUser.uid; // Default chi accetta inizia

    if (gameName === 'TicTacToe') {
        initialBoard = Array(9).fill(null);
    } else if (gameName === 'ConnectFour') {
        initialBoard = Array(42).fill(null);
    } else if (gameName === 'MemoryGame') {
        // Init Memory: Genera coppie e mescola
        const EMOJIS = ['🍕', '🚀', '🐱', '🌵', '🎈', '💎', '🔥', '🎉'];
        initialBoard = [...EMOJIS, ...EMOJIS]
            .sort(() => Math.random() - 0.5)
            .map((icon, index) => ({ id: index, icon, isFlipped: false, isMatched: false, matchedBy: null }));
    }

    await updateDoc(chatRef, {
      activeGame: { 
          gameName, 
          status: 'active', 
          startedAt: serverTimestamp(), 
          board: initialBoard, 
          turn: turn, 
          winner: null, 
          players: { [currentUser.uid]: 'PLAYER_1', [otherUser.uid]: 'PLAYER_2' } 
      }
    });
  };

  const handleDeclineInvite = async (messageId) => {
    await updateDoc(doc(db, "chats", chatId, "messages", messageId), { status: 'rejected' });
  };

  const handleExitGame = async () => {
    if (window.confirm("Se esci, la partita terminerà per entrambi. Confermi?")) {
      await updateDoc(doc(db, "chats", chatId), { activeGame: null }); 
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                {isDeleted ? 'Account Eliminato' : (receiverData.status === 'online' ? '● Online' : 'Offline')}
            </div>
          </div>
        </div>
        
        {!isDeleted && (
            <div className="games-dropdown-container">
            <button className="game-btn" onClick={() => setShowGameMenu(!showGameMenu)}>🎮 Gioca Insieme</button>
            {showGameMenu && (
                <div className="games-menu">
                  <div className="game-option" onClick={() => handleInviteClick('TicTacToe')}><span>🎯</span> Tris</div>
                  <div className="game-option" onClick={() => handleInviteClick('ConnectFour')}><span>🔴</span> Forza 4</div>
                  <div className="game-option" onClick={() => handleInviteClick('MemoryGame')}><span>🧠</span> Memory</div>
                </div>
            )}
            </div>
        )}
      </div>

      <div className="messages-area">
        {messages.map(m => {
           const isMe = m.senderId === currentUser.uid;
           if (m.type === 'system' || m.senderId === 'system') return <div key={m.id} className="system-message">{m.text}</div>;
           if (m.type === 'invite') {
             return (
               <div key={m.id} className={`bubble ${isMe ? 'me' : 'them'}`} style={{background:'transparent', padding:0, boxShadow:'none'}}>
                 <div className="invite-card">
                  <div className="invite-header">
                    <span>{m.gameName === 'TicTacToe' ? '🎯' : (m.gameName === 'ConnectFour' ? '🔴' : '🧠')}</span>
                    <span>{isMe ? 'Hai inviato una sfida' : `${receiverData.name} ti sfida!`}</span>
                  </div>
                   {m.status === 'pending' ? (
                     <div className="invite-actions">
                       {isMe ? <span className="invite-status">In attesa...</span> : (
                         <>
                           <button className="invite-btn btn-decline" onClick={() => handleDeclineInvite(m.id)}>Rifiuta</button>
                           <button className="invite-btn btn-accept" onClick={() => handleAcceptInvite(m.id, m.gameName)}>Accetta</button>
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