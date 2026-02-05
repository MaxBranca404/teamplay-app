import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { X, Eraser, Pen, StickyNote, Download, AlertTriangle } from 'lucide-react';

export default function SharedWhiteboard({ isSolo, chatId, currentUser, onExit }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // --- STATI LOCALI ---
  const [tool, setTool] = useState('pen'); // pen, eraser, note
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [sizeAlert, setSizeAlert] = useState(null); // Alert se ci avviciniamo al limite
  
  // Dati Lavagna
  const [elements, setElements] = useState([]); // Array di tratti
  const [notes, setNotes] = useState([]); // Array di note testuali
  
  const MAX_DOC_SIZE = 1000000; 

  // --- LISTENER PER NAVIGAZIONE ESTERNA (APP.JSX) ---
  useEffect(() => {
      const handleExternalExit = (e) => {
          const navigationCallback = e.detail?.callback;
          // Avvia chiusura passando la callback di navigazione
          initiateCloseSequence(true, navigationCallback);
      };

      window.addEventListener('request-whiteboard-exit', handleExternalExit);
      return () => window.removeEventListener('request-whiteboard-exit', handleExternalExit);
  }, [elements, notes]); // Dipendenze importanti per lo stato aggiornato

  // --- SINCRONIZZAZIONE FIRESTORE ---
  useEffect(() => {
    if (isSolo || !chatId) return;
    const unsubscribe = onSnapshot(doc(db, "chats", chatId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data().activeGame;
        if (data) {
            if (data.elements) setElements(data.elements);
            if (data.notes) setNotes(data.notes);
            
            // Chiusura passiva
            if (data.status === 'finished' && data.endedBy !== currentUser.uid) {
               // Chiude senza chiedere salvataggio (lo fa solo chi chiude) o chiedendo, a scelta.
               // Qui chiediamo:
               initiateCloseSequence(false);
            }
        }
      }
    });
    return () => unsubscribe();
  }, [chatId, isSolo]);

  const getPayloadSize = (data) => {
      return new Blob([JSON.stringify(data)]).size;
  };

  const syncToFirestore = async (newElements, newNotes) => {
      if(isSolo) return;
      
      const payloadElements = newElements || elements;
      const payloadNotes = newNotes || notes;
      
      const currentSize = getPayloadSize({ elements: payloadElements, notes: payloadNotes });

      if (currentSize > MAX_DOC_SIZE) {
          setSizeAlert("Lavagna piena! Impossibile aggiungere altri tratti.");
          return;
      } else {
          setSizeAlert(null);
      }

      await updateDoc(doc(db, "chats", chatId), {
          "activeGame.elements": payloadElements,
          "activeGame.notes": payloadNotes
      });
  };

  // --- GESTIONE CANVAS & DISEGNO ---
  useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      elements.forEach(el => {
          if (el.type === 'stroke') {
              ctx.beginPath();
              ctx.strokeStyle = el.color;
              ctx.lineWidth = el.width;
              if (el.points.length > 0) {
                  ctx.moveTo(el.points[0].x, el.points[0].y);
                  el.points.forEach(p => ctx.lineTo(p.x, p.y));
              }
              ctx.stroke();
          }
      });
  }, [elements]); 

  // Responsive Canvas
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);

  useEffect(() => {
      const handleResize = () => {
          if (containerRef.current) {
              setWidth(containerRef.current.offsetWidth);
              setHeight(containerRef.current.offsetHeight);
          }
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startDrawing = (e) => {
      if (sizeAlert) return;
      
      if (tool === 'note') {
          addNote(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          return;
      }
      setIsDrawing(true);
      
      const x = Math.round(e.nativeEvent.offsetX);
      const y = Math.round(e.nativeEvent.offsetY);

      const newStroke = {
          type: 'stroke',
          points: [{ x, y }],
          color: tool === 'eraser' ? '#ffffff' : color,
          width: tool === 'eraser' ? 20 : lineWidth
      };
      setElements(prev => [...prev, newStroke]);
  };

  const draw = (e) => {
      if (!isDrawing) return;
      
      const x = Math.round(e.nativeEvent.offsetX);
      const y = Math.round(e.nativeEvent.offsetY);
      
      const newElements = [...elements];
      const currentStroke = newElements[newElements.length - 1];
      const lastPoint = currentStroke.points[currentStroke.points.length - 1];

      const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
      if (dist < 4) return; 

      currentStroke.points.push({ x, y });
      setElements(newElements);
  };

  const endDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      syncToFirestore(elements, null);
  };

  const addNote = (x, y) => {
      if (sizeAlert) return;
      const text = prompt("Scrivi la nota:");
      if (text) {
          const newNotes = [...notes, { x: Math.round(x), y: Math.round(y), text, id: Date.now() }];
          setNotes(newNotes);
          syncToFirestore(null, newNotes);
      }
  };

  // --- SALVATAGGIO CON SFONDO BIANCO ---
  const handleSaveImage = () => {
      const canvas = canvasRef.current;
      
      // Crea canvas temporaneo
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext('2d');
      
      // Riempi di bianco
      tCtx.fillStyle = '#ffffff';
      tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Disegna il contenuto sopra
      tCtx.drawImage(canvas, 0, 0);
      
      const link = document.createElement('a');
      link.download = `lavagna-${Date.now()}.png`;
      link.href = tempCanvas.toDataURL();
      link.click();
  };

  // Funzione unificata di chiusura
  const initiateCloseSequence = async (initiator = true, onCompleteCallback = null) => {
      if (initiator) {
          if (window.confirm("Vuoi salvare la lavagna come immagine prima di uscire?")) {
              handleSaveImage();
          }
      } else {
          if (window.confirm("La sessione è terminata. Vuoi salvare l'immagine?")) {
              handleSaveImage();
          }
      }
      
      if (initiator && !isSolo) {
          await updateDoc(doc(db, "chats", chatId), { "activeGame.status": 'finished', "activeGame.endedBy": currentUser.uid });
          setTimeout(() => {
             updateDoc(doc(db, "chats", chatId), { activeGame: null }); 
          }, 2000);
      }
      
      // Chiama onExit con force=true per evitare il confirm del wrapper
      onExit(true);

      if (onCompleteCallback) onCompleteCallback();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f3f4f6', position: 'relative' }}>
      <div style={{ 
          padding: '10px', background: 'white', borderBottom: '1px solid #e5e7eb',
          display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
          <div style={{display:'flex', gap: 5, borderRight: '1px solid #ddd', paddingRight: 10}}>
            <button className={`tool-btn ${tool==='pen'?'active':''}`} onClick={()=>setTool('pen')} title="Penna"><Pen size={18}/></button>
            <button className={`tool-btn ${tool==='eraser'?'active':''}`} onClick={()=>setTool('eraser')} title="Gomma"><Eraser size={18}/></button>
            <button className={`tool-btn ${tool==='note'?'active':''}`} onClick={()=>setTool('note')} title="Nota"><StickyNote size={18}/></button>
          </div>

          <div style={{display:'flex', gap: 5, borderRight: '1px solid #ddd', paddingRight: 10}}>
             {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b'].map(c => (
                 <div key={c} onClick={()=>setColor(c)} 
                      style={{
                          width:24, height:24, borderRadius:'50%', background:c, 
                          cursor:'pointer', border: color===c ? '2px solid #000' : '2px solid transparent',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }} 
                 />
             ))}
          </div>

          <input type="range" min="1" max="20" value={lineWidth} onChange={(e)=>setLineWidth(e.target.value)} style={{width: 80, cursor:'pointer'}} title="Spessore" />

          <div style={{marginLeft: 'auto', display: 'flex', gap: 10}}>
              <button className="tool-btn" onClick={handleSaveImage} title="Scarica"><Download size={18}/></button>
              <button className="tool-btn delete" onClick={() => initiateCloseSequence(true)} title="Termina">
                  <span style={{fontWeight:'bold', fontSize:'0.9rem', display:'flex', alignItems:'center', gap:5}}>Termina <X size={16}/></span>
              </button>
          </div>
      </div>

      {sizeAlert && (
          <div style={{
              background: '#fee2e2', color: '#b91c1c', padding: '8px', fontSize: '0.85rem', 
              textAlign: 'center', borderBottom: '1px solid #fca5a5', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6
          }}>
              <AlertTriangle size={14} /> {sizeAlert}
          </div>
      )}

      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: tool === 'pen' ? 'crosshair' : (tool === 'eraser' ? 'cell' : 'default') }}>
          <canvas
              ref={canvasRef}
              width={width}
              height={height}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={endDrawing}
              onMouseLeave={endDrawing}
              style={{ background: 'white', display: 'block' }}
          />
          
          {notes.map(note => (
              <div key={note.id} style={{
                  position: 'absolute', left: note.x, top: note.y,
                  background: '#fef3c7', padding: '10px', borderRadius: '4px', border: '1px solid #fcd34d',
                  boxShadow: '2px 2px 8px rgba(0,0,0,0.1)', maxWidth: '150px',
                  fontSize: '0.9rem', fontFamily: 'cursive', pointerEvents: 'none', color: '#4b5563'
              }}>
                  {note.text}
              </div>
          ))}
          
          <div style={{position:'absolute', bottom: 10, left: 10, opacity: 0.5, fontSize: '0.75rem', pointerEvents:'none', userSelect:'none'}}>
              TeamPlay Whiteboard (Light Version)
          </div>
      </div>
    </div>
  );
}