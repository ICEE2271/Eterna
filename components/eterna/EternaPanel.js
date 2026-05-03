'use client'
import { useState, useRef, useEffect } from 'react'

export default function EternaPanel({ messages, setMessages, addMessage, activeThread, orbState, setOrbState, userName, currentNote, currentView, onActivityPing }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [listening, setListening] = useState(false)
  const [pendingImages, setPendingImages] = useState([])
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Voice recognition setup
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = false
    r.interimResults = false
    r.onresult = (e) => {
      const text = e.results[0][0].transcript
      setInput(text)
      setListening(false)
    }
    r.onend = () => setListening(false)
    recognitionRef.current = r
  }, [])

  const speak = (text) => {
    if (!voiceOn || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.slice(0, 500))
    u.rate = 0.9; u.pitch = 1.0; u.volume = 0.85
    const voices = speechSynthesis.getVoices()
    const v = voices.find(v => v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Female'))
    if (v) u.voice = v
    speechSynthesis.speak(u)
  }

  const send = async (text, isObs = false) => {
    const content = text || input.trim()
    if (!content && pendingImages.length === 0) return
    if (!activeThread) return
    onActivityPing?.()

    if (!isObs) {
      addMessage('user', content)
      setInput('')
      setPendingImages([])
    }

    setLoading(true)
    setOrbState('thinking')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: activeThread.id,
          content,
          userName,
          isObservation: isObs,
          context: { view: currentView, noteTitle: currentNote?.title },
          images: pendingImages.map(p => ({ mediaType: p.type, data: p.base64 }))
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setOrbState('speaking')
      // Typewriter
      const id = Date.now() + 1
      addMessage('assistant', '', data.model)
      let i = 0
      const iv = setInterval(() => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content: data.reply.slice(0, i) } : m))
        i += 3
        if (i > data.reply.length) {
          clearInterval(iv)
          setMessages(prev => prev.map(m => m.id === id ? { ...m, content: data.reply } : m))
          setOrbState('idle')
          speak(data.reply)
        }
      }, 10)
    } catch (err) {
      addMessage('assistant', `Connection error: ${err.message}`)
      setOrbState('idle')
    }
    setLoading(false)
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const handleImages = async (files) => {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      const base64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(f) })
      setPendingImages(prev => [...prev, { name: f.name, type: f.type, base64, preview: URL.createObjectURL(f) }])
    }
  }

  const toggleVoice = () => {
    if (voiceOn) { speechSynthesis.cancel(); setVoiceOn(false) }
    else setVoiceOn(true)
  }

  const toggleListen = () => {
    if (!recognitionRef.current) return
    if (listening) { recognitionRef.current.stop(); setListening(false) }
    else { recognitionRef.current.start(); setListening(true) }
  }

  const name = userName || 'Keeper'

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
      {/* Orb header */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div className={`eterna-orb ${orbState === 'speaking' ? 'speaking' : orbState === 'thinking' ? 'thinking' : ''}`}
          style={{ width: 64, height: 64 }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 12, letterSpacing: 4, color: 'rgba(255,255,255,0.7)' }}>ETERNA</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, letterSpacing: 1 }}>
            {orbState === 'thinking' ? 'thinking...' : orbState === 'speaking' ? 'speaking' : 'observing'}
          </div>
        </div>
        {/* Controls */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={toggleVoice} className="e-btn" style={{ padding: '3px 8px', fontSize: 10 }}>
            {voiceOn ? '🔊' : '🔇'}
          </button>
          <button onClick={toggleListen} className={`e-btn ${listening ? 'e-btn-accent' : ''}`} style={{ padding: '3px 8px', fontSize: 10 }}>
            {listening ? '⏹ Stop' : '🎙 Speak'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', lineHeight: 1.8 }}>
            I am watching, {name}.<br/>Speak, or I will when I have something worth saying.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id || i} className="msg-in" style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div className="eterna-orb" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '4px 12px 12px 12px', padding: '8px 12px', fontSize: 13, lineHeight: 1.65, color: 'var(--text)', maxWidth: '90%' }}>
                  <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 4 }}>ETERNA</span>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                  {m.content === '' && loading && <div className="dot-pulse" style={{ display: 'flex', gap: 4, padding: '4px 0' }}><span/><span/><span/></div>}
                </div>
              </div>
            )}
            {m.role === 'user' && (
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px 4px 12px 12px', padding: '8px 12px', fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.85)', maxWidth: '90%' }}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
              </div>
            )}
          </div>
        ))}
        {loading && orbState === 'thinking' && messages[messages.length-1]?.role !== 'assistant' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div className="eterna-orb" style={{ width: 18, height: 18, flexShrink: 0 }} />
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '4px 12px 12px 12px', padding: '10px 14px' }}>
              <div className="dot-pulse" style={{ display: 'flex', gap: 4 }}><span/><span/><span/></div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Pending images */}
      {pendingImages.length > 0 && (
        <div style={{ padding: '6px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
          {pendingImages.map((img, i) => (
            <div key={i} style={{ position: 'relative', width: 44, height: 44, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={img.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => setPendingImages(p => p.filter((_,j)=>j!==i))} style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; onActivityPing?.() }}
            onKeyDown={handleKey}
            placeholder={`Speak, ${name}...`}
            rows={1}
            disabled={!activeThread}
            style={{ flex: 1, background: 'var(--raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', maxHeight: 120, lineHeight: 1.5 }}
          />
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleImages(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} className="e-btn" style={{ padding: '8px', flexShrink: 0 }}>📎</button>
          <button onClick={() => send()} disabled={!activeThread || loading} className="e-btn-accent" style={{ padding: '8px 12px', flexShrink: 0, opacity: (!activeThread || loading) ? 0.4 : 1 }}>▶</button>
        </div>
      </div>
    </div>
  )
}
