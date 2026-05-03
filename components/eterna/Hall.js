'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function Hall({ onOpenNote, onGraphRefresh }) {
  const [folders, setFolders] = useState([])
  const [activeFolder, setActiveFolder] = useState(null)
  const [notes, setNotes] = useState([])
  const [newFolderName, setNewFolderName] = useState('')
  const [newNoteName, setNewNoteName] = useState('')
  const [creating, setCreating] = useState(null)
  const [loading, setLoading] = useState(true)
  const db = supabase()

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await db.from('hall_folders').select('*').order('name')
    setFolders(data || [])
    setLoading(false)
  }

  const loadNotes = async (fid) => {
    const q = fid
      ? db.from('hall_notes').select('*').eq('folder_id', fid)
      : db.from('hall_notes').select('*')
    const { data } = await q.order('updated_at', { ascending: false })
    setNotes(data || [])
  }

  const selectFolder = (f) => { setActiveFolder(f); loadNotes(f?.id || null) }

  const createNote = async () => {
    if (!newNoteName.trim()) return
    const { data } = await db.from('hall_notes').insert({ title: newNoteName, content: '', folder_id: activeFolder?.id || null }).select().single()
    setNewNoteName(''); setCreating(null)
    if (data) { onOpenNote(data); await loadNotes(activeFolder?.id) }
    onGraphRefresh?.()
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    await db.from('hall_folders').insert({ name: newFolderName }).select()
    setNewFolderName(''); setCreating(null); await load()
  }

  const deleteNote = async (id) => {
    if (!confirm('Delete this note?')) return
    await db.from('hall_notes').delete().eq('id', id)
    await loadNotes(activeFolder?.id); onGraphRefresh?.()
  }

  const deleteFolder = async (id) => {
    if (!confirm('Delete folder and all its notes?')) return
    await db.from('hall_notes').delete().eq('folder_id', id)
    await db.from('hall_folders').delete().eq('id', id)
    if (activeFolder?.id === id) { setActiveFolder(null); setNotes([]) }
    await load(); onGraphRefresh?.()
  }

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* Folder sidebar */}
      <div style={{ width: 200, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2 }}>FOLDERS</span>
          <button className="tree-action-btn" onClick={() => setCreating('folder')} style={{ width: 20, height: 20 }}>+</button>
        </div>

        {creating === 'folder' && (
          <div style={{ padding: '6px 10px' }}>
            <input autoFocus value={newFolderName} onChange={e=>setNewFolderName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')createFolder();if(e.key==='Escape')setCreating(null)}}
              placeholder="Folder name..." className="e-input" style={{fontSize:12,padding:'4px 8px'}} />
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className={`tree-row ${!activeFolder?'active':''}`} onClick={() => selectFolder(null)} style={{ padding: '6px 12px' }}>
            <span className="tree-label" style={{ fontSize: 12 }}>All Notes</span>
          </div>
          {folders.map(f => (
            <div key={f.id} className={`tree-row ${activeFolder?.id===f.id?'active':''}`}
              style={{ padding: '6px 12px', paddingRight: 4 }}
              onClick={() => selectFolder(f)}>
              <span className="tree-label" style={{ fontSize: 12 }}>📁 {f.name}</span>
              <div className="tree-actions" onClick={e=>e.stopPropagation()}>
                <button className="tree-action-btn" onClick={() => deleteFolder(f.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 13, letterSpacing: 3, color: 'rgba(255,255,255,0.5)' }}>
            {activeFolder ? activeFolder.name.toUpperCase() : 'ALL NOTES'}
          </h2>
          <button className="e-btn" onClick={() => setCreating('note')} style={{ fontSize: 12, padding: '5px 12px' }}>+ New Note</button>
        </div>

        {creating === 'note' && (
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
            <input autoFocus value={newNoteName} onChange={e=>setNewNoteName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')createNote();if(e.key==='Escape')setCreating(null)}}
              placeholder="Note title..." className="e-input" />
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading...</div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 60, fontSize: 13, fontStyle: 'italic' }}>
              {activeFolder ? `No notes in ${activeFolder.name} yet.` : 'No notes yet. Create one to begin.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
              {notes.map(n => (
                <div key={n.id}
                  style={{ background: 'var(--raised)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
                  onClick={() => onOpenNote(n)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <div style={{ fontFamily: 'Cinzel,serif', fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 8, paddingRight: 20 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(n.updated_at).toLocaleDateString()}</div>
                  <button onClick={e=>{e.stopPropagation();deleteNote(n.id)}}
                    style={{ position:'absolute',top:10,right:10,background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',opacity:0,fontSize:12,transition:'opacity 0.1s' }}
                    onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0'}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
