'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const Graph = dynamic(() => import('../../components/eterna/Graph'), { ssr: false })
const Hall = dynamic(() => import('../../components/eterna/Hall'), { ssr: false })
const Editor = dynamic(() => import('../../components/eterna/Editor'), { ssr: false })
const EternaPanel = dynamic(() => import('../../components/eterna/EternaPanel'), { ssr: false })
const Sidebar = dynamic(() => import('../../components/eterna/Sidebar'), { ssr: false })
const Settings = dynamic(() => import('../../components/eterna/Settings'), { ssr: false })
const ColorPicker = dynamic(() => import('../../components/eterna/ColorPicker'), { ssr: false })

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [userName, setUserName] = useState('')
  const [view, setView] = useState('graph')
  const [openNote, setOpenNote] = useState(null)
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [orbState, setOrbState] = useState('idle')
  const [sidebarW, setSidebarW] = useState(220)
  const [panelW, setPanelW] = useState(300)
  const [showSettings, setShowSettings] = useState(false)
  const [showColors, setShowColors] = useState(false)
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] })
  const router = useRouter()
  const db = supabase()

  // Observation timer — Eterna speaks unprompted
  const obsTimer = useRef(null)
  const lastActivity = useRef(Date.now())

  useEffect(() => {
    db.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUser(user)
      loadUserData(user)
    })
  }, [])

  // Eterna observation loop — speaks every 3-8 mins of inactivity
  useEffect(() => {
    if (!activeThread) return
    const check = () => {
      const idle = Date.now() - lastActivity.current
      if (idle > 180000 && messages.length > 0) { // 3 min idle
        triggerObservation()
      }
    }
    obsTimer.current = setInterval(check, 60000)
    return () => clearInterval(obsTimer.current)
  }, [activeThread, messages])

  const triggerObservation = async () => {
    if (!activeThread || orbState !== 'idle') return
    setOrbState('thinking')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: activeThread.id, content: '__observe__', userName, isObservation: true })
      })
      const data = await res.json()
      if (data.reply) {
        addMessage('assistant', data.reply, data.model)
        setOrbState('speaking')
        setTimeout(() => setOrbState('idle'), 3000)
      } else setOrbState('idle')
    } catch { setOrbState('idle') }
    lastActivity.current = Date.now()
  }

  const loadUserData = async (u) => {
    // Load settings/name
    const { data: settings } = await db.from('user_settings').select('*').eq('user_id', u.id).single()
    if (settings?.display_name) setUserName(settings.display_name)
    else if (u.user_metadata?.display_name) setUserName(u.user_metadata.display_name)

    // Load colors from settings
    if (settings?.colors) {
      try {
        const colors = JSON.parse(settings.colors)
        Object.entries(colors).forEach(([k,v]) => document.documentElement.style.setProperty(k, v))
      } catch {}
    }

    // Load threads
    const { data: threadData } = await db.from('chat_threads').select('*').eq('user_id', u.id).order('updated_at', { ascending: false })
    const t = threadData || []
    setThreads(t)
    if (t.length > 0) await selectThread(t[0])
    else await createThread(u.id)

    // Load graph
    loadGraph()
  }

  const loadGraph = async () => {
    const res = await fetch('/api/hall?action=graph')
    const data = await res.json()
    setGraphData(data)
  }

  const createThread = async (userId) => {
    const uid = userId || user?.id
    if (!uid) return
    const { data } = await db.from('chat_threads').insert({ user_id: uid, title: 'Main' }).select().single()
    if (data) { setThreads(prev => [data, ...prev]); await selectThread(data) }
  }

  const selectThread = async (thread) => {
    setActiveThread(thread)
    const { data } = await db.from('chat_messages').select('*').eq('thread_id', thread.id).order('created_at', { ascending: true })
    setMessages(data || [])
  }

  const addMessage = (role, content, model) => {
    setMessages(prev => [...prev, { id: Date.now(), role, content, model, created_at: new Date().toISOString() }])
  }

  const handleOpenNote = (note) => { setOpenNote(note); setView('editor') }
  const handleCloseNote = () => { setOpenNote(null); setView('hall') }

  const signOut = async () => { await db.auth.signOut(); router.push('/') }

  // Sidebar resize
  const resizingSidebar = useRef(false)
  const handleSidebarResize = useCallback((e) => {
    if (!resizingSidebar.current) return
    const newW = Math.max(160, Math.min(400, e.clientX))
    setSidebarW(newW)
  }, [])

  // Panel resize
  const resizingPanel = useRef(false)
  const handlePanelResize = useCallback((e) => {
    if (!resizingPanel.current) return
    const newW = Math.max(220, Math.min(500, window.innerWidth - e.clientX))
    setPanelW(newW)
  }, [])

  useEffect(() => {
    const up = () => { resizingSidebar.current = false; resizingPanel.current = false; document.body.style.cursor = '' }
    window.addEventListener('mousemove', handleSidebarResize)
    window.addEventListener('mousemove', handlePanelResize)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', handleSidebarResize); window.removeEventListener('mousemove', handlePanelResize); window.removeEventListener('mouseup', up) }
  }, [])

  if (!user) return <div style={{ height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="eterna-orb" style={{ width: 48, height: 48 }} /></div>

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--bg)', overflow: 'hidden' }}>
      {showSettings && <Settings user={user} onClose={() => setShowSettings(false)} onColorsOpen={() => { setShowSettings(false); setShowColors(true) }} />}
      {showColors && <ColorPicker user={user} onClose={() => setShowColors(false)} />}

      {/* Sidebar */}
      <div style={{ width: sidebarW, flexShrink: 0, position: 'relative' }} className="panel">
        <Sidebar
          view={view} onViewChange={setView}
          threads={threads} activeThread={activeThread}
          onSelectThread={selectThread}
          onCreateThread={() => createThread()}
          onOpenNote={handleOpenNote}
          onSettings={() => setShowSettings(true)}
          onColors={() => setShowColors(true)}
          onSignOut={signOut}
          user={user} userName={userName}
          onGraphRefresh={loadGraph}
        />
        {/* Resize handle */}
        <div className="resize-handle" style={{ right: -2 }}
          onMouseDown={() => { resizingSidebar.current = true; document.body.style.cursor = 'col-resize' }} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onMouseMove={() => lastActivity.current = Date.now()}
        onKeyDown={() => lastActivity.current = Date.now()}>
        {view === 'graph' && <Graph data={graphData} onNodeClick={handleOpenNote} onRefresh={loadGraph} />}
        {view === 'hall' && <Hall onOpenNote={handleOpenNote} onGraphRefresh={loadGraph} />}
        {view === 'editor' && openNote && <Editor note={openNote} onClose={handleCloseNote} onNoteChange={setOpenNote} onOpenNote={handleOpenNote} onGraphRefresh={loadGraph} />}
        {view === 'settings' && <Settings user={user} onClose={() => setView('graph')} onColorsOpen={() => setShowColors(true)} inline />}
      </div>

      {/* Eterna panel resize handle */}
      <div className="resize-handle" style={{ right: panelW - 2, position: 'fixed', top: 0, bottom: 0 }}
        onMouseDown={() => { resizingPanel.current = true; document.body.style.cursor = 'col-resize' }} />

      {/* Eterna panel */}
      <div style={{ width: panelW, flexShrink: 0, position: 'relative' }}>
        <EternaPanel
          messages={messages} setMessages={setMessages}
          addMessage={addMessage}
          activeThread={activeThread}
          orbState={orbState} setOrbState={setOrbState}
          userName={userName}
          currentNote={openNote}
          currentView={view}
          onActivityPing={() => lastActivity.current = Date.now()}
        />
      </div>
    </div>
  )
}
