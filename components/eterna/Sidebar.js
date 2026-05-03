'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const VIEWS = [
  { id: 'graph', icon: '✦', label: 'Graph' },
  { id: 'hall', icon: '⟁', label: 'Hall' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
]

export default function Sidebar({ view, onViewChange, threads, activeThread, onSelectThread, onCreateThread, onOpenNote, onSettings, onColors, onSignOut, user, userName, onGraphRefresh }) {
  const [folders, setFolders] = useState([])
  const [openFolders, setOpenFolders] = useState({})
  const [notesByFolder, setNotesByFolder] = useState({})
  const [search, setSearch] = useState('')
  const [searchRes, setSearchRes] = useState([])
  const [ctx, setCtx] = useState(null) // context menu
  const [creating, setCreating] = useState(null) // {type, parentId}
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState(null)
  const db = supabase()

  useEffect(() => { loadFolders() }, [])

  const loadFolders = async () => {
    const { data } = await db.from('hall_folders').select('*').order('name')
    setFolders(data || [])
  }

  const loadNotes = async (fid) => {
    const { data } = await db.from('hall_notes').select('id,title,folder_id,updated_at').eq('folder_id', fid).order('title')
    setNotesByFolder(p => ({ ...p, [fid]: data || [] }))
  }

  const toggleFolder = async (id) => {
    const open = !openFolders[id]
    setOpenFolders(p => ({ ...p, [id]: open }))
    if (open && !notesByFolder[id]) await loadNotes(id)
  }

  const handleSearch = async (q) => {
    setSearch(q)
    if (q.length < 2) { setSearchRes([]); return }
    const { data } = await db.from('hall_notes').select('id,title,folder_id').or(`title.ilike.%${q}%,content.ilike.%${q}%`).limit(15)
    setSearchRes(data || [])
  }

  const startCreate = (type, parentId = null) => {
    setCreating({ type, parentId })
    setNewName('')
    if (parentId) setOpenFolders(p => ({ ...p, [parentId]: true }))
    setCtx(null)
  }

  const confirmCreate = async () => {
    if (!newName.trim()) { setCreating(null); return }
    if (creating.type === 'folder') {
      await db.from('hall_folders').insert({ user_id: user.id, name: newName, parent_id: creating.parentId })
      await loadFolders()
    } else if (creating.type === 'note') {
      const { data } = await db.from('hall_notes').insert({ user_id: user.id, title: newName, content: '', folder_id: creating.parentId }).select().single()
      if (data) { onOpenNote(data); if (creating.parentId) await loadNotes(creating.parentId) }
    }
    setCreating(null); setNewName('')
    onGraphRefresh?.()
  }

  const deleteFolder = async (id) => {
    if (!confirm('Delete folder and all its notes?')) return
    await db.from('hall_notes').delete().eq('folder_id', id)
    await db.from('hall_folders').delete().eq('id', id)
    setOpenFolders(p => { const n = {...p}; delete n[id]; return n })
    setNotesByFolder(p => { const n = {...p}; delete n[id]; return n })
    await loadFolders(); setCtx(null); onGraphRefresh?.()
  }

  const deleteNote = async (id, fid) => {
    if (!confirm('Delete this note?')) return
    await db.from('hall_notes').delete().eq('id', id)
    if (fid) await loadNotes(fid)
    setCtx(null); onGraphRefresh?.()
  }

  const renameItem = async () => {
    if (!newName.trim() || !renaming) return
    if (renaming.type === 'folder') {
      await db.from('hall_folders').update({ name: newName }).eq('id', renaming.id)
      await loadFolders()
    } else {
      await db.from('hall_notes').update({ title: newName }).eq('id', renaming.id)
      if (renaming.folderId) await loadNotes(renaming.folderId)
    }
    setRenaming(null); setNewName(''); setCtx(null)
  }

  const openCtx = (e, data) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, ...data }) }

  // Build folder tree (supports nested via parent_id)
  const topFolders = folders.filter(f => !f.parent_id)
  const childFolders = (parentId) => folders.filter(f => f.parent_id === parentId)

  const renderFolder = (folder, depth = 0) => (
    <div key={folder.id}>
      <div className="tree-row" style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => toggleFolder(folder.id)}
        onContextMenu={(e) => openCtx(e, { type: 'folder', id: folder.id, name: folder.name })}>
        <span className={`tree-chevron ${openFolders[folder.id] ? 'open' : ''}`}>▸</span>
        <span className="tree-icon">📁</span>
        {renaming?.type === 'folder' && renaming.id === folder.id ? (
          <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')renameItem();if(e.key==='Escape')setRenaming(null)}}
            onClick={e=>e.stopPropagation()}
            style={{flex:1,background:'var(--raised)',border:'1px solid var(--border-hover)',borderRadius:4,padding:'1px 4px',color:'var(--text)',fontSize:12,outline:'none'}} />
        ) : (
          <span className="tree-label">{folder.name}</span>
        )}
        <div className="tree-actions" onClick={e=>e.stopPropagation()}>
          <button className="tree-action-btn" onClick={()=>startCreate('note',folder.id)} title="New note">+</button>
          <button className="tree-action-btn" onClick={()=>startCreate('folder',folder.id)} title="New subfolder">📁</button>
        </div>
      </div>

      {openFolders[folder.id] && (
        <div>
          {/* Inline create */}
          {creating?.parentId === folder.id && creating.type === 'note' && (
            <div style={{ paddingLeft: 8 + (depth+1) * 14, paddingRight: 8, paddingBottom: 2 }}>
              <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter')confirmCreate();if(e.key==='Escape')setCreating(null)}}
                placeholder="Note title..." className="e-input" style={{fontSize:12,padding:'3px 6px'}} />
            </div>
          )}
          {creating?.parentId === folder.id && creating.type === 'folder' && (
            <div style={{ paddingLeft: 8 + (depth+1) * 14, paddingRight: 8, paddingBottom: 2 }}>
              <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter')confirmCreate();if(e.key==='Escape')setCreating(null)}}
                placeholder="Folder name..." className="e-input" style={{fontSize:12,padding:'3px 6px'}} />
            </div>
          )}
          {/* Child folders */}
          {childFolders(folder.id).map(cf => renderFolder(cf, depth + 1))}
          {/* Notes */}
          {(notesByFolder[folder.id] || []).map(note => (
            <div key={note.id} className="tree-row" style={{ paddingLeft: 8 + (depth+1) * 14 }}
              onClick={() => onOpenNote(note)}
              onContextMenu={(e) => openCtx(e, { type: 'note', id: note.id, folderId: folder.id, name: note.title })}>
              <span style={{ width: 10, flexShrink: 0 }} />
              <span className="tree-icon">📄</span>
              {renaming?.type === 'note' && renaming.id === note.id ? (
                <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')renameItem();if(e.key==='Escape')setRenaming(null)}}
                  onClick={e=>e.stopPropagation()}
                  style={{flex:1,background:'var(--raised)',border:'1px solid var(--border-hover)',borderRadius:4,padding:'1px 4px',color:'var(--text)',fontSize:12,outline:'none'}} />
              ) : (
                <span className="tree-label" style={{ fontSize: 12 }}>{note.title}</span>
              )}
            </div>
          ))}
          {notesByFolder[folder.id]?.length === 0 && !creating && (
            <div style={{ paddingLeft: 8 + (depth+1) * 14, color: 'var(--text-muted)', fontSize: 11, paddingTop: 2, paddingBottom: 2, fontStyle: 'italic' }}>Empty</div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'Cinzel,serif', fontSize: 11, letterSpacing: 5, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>ETERNA</div>
        <input value={search} onChange={e=>handleSearch(e.target.value)} placeholder="Search notes..." className="e-input" style={{ fontSize: 12, padding: '6px 10px' }} />
        {searchRes.length > 0 && (
          <div style={{ background: 'var(--raised)', border: '1px solid var(--border)', borderRadius: 6, marginTop: 4, overflow: 'hidden' }}>
            {searchRes.map(r => (
              <div key={r.id} onClick={() => { onOpenNote(r); setSearch(''); setSearchRes([]) }}
                className="tree-row" style={{ padding: '6px 10px', fontSize: 12 }}>{r.title}</div>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => onViewChange(v.id)}
            className={`tab ${view === v.id ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', marginBottom: 2, padding: '5px 8px' }}>
            <span style={{ fontSize: 12 }}>{v.icon}</span>
            <span>{v.label}</span>
          </button>
        ))}
      </div>

      {/* Hall tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 6px', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2 }}>HALL</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="tree-action-btn" onClick={() => startCreate('folder')} title="New folder" style={{ width: 20, height: 20 }}>📁</button>
            <button className="tree-action-btn" onClick={() => startCreate('note')} title="New note" style={{ width: 20, height: 20 }}>+</button>
          </div>
        </div>

        {/* Root-level create */}
        {creating && !creating.parentId && (
          <div style={{ padding: '0 8px 4px' }}>
            <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')confirmCreate();if(e.key==='Escape')setCreating(null)}}
              placeholder={creating.type === 'folder' ? 'Folder name...' : 'Note title...'}
              className="e-input" style={{ fontSize: 12, padding: '4px 8px' }} />
          </div>
        )}

        {topFolders.map(f => renderFolder(f))}

        {/* Threads */}
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 6px' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2 }}>THREADS</span>
            <button className="tree-action-btn" onClick={onCreateThread} style={{ width: 20, height: 20 }}>+</button>
          </div>
          {threads.map(t => (
            <div key={t.id} className={`tree-row ${activeThread?.id === t.id ? 'active' : ''}`}
              style={{ paddingLeft: 10 }} onClick={() => onSelectThread(t)}>
              <span className="tree-icon">💬</span>
              <span className="tree-label" style={{ fontSize: 12 }}>{t.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{userName || user?.email}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="tree-action-btn" onClick={onColors} title="Colors" style={{ width: 24, height: 24, fontSize: 12 }}>🎨</button>
          <button className="tree-action-btn" onClick={onSettings} title="Settings" style={{ width: 24, height: 24, fontSize: 12 }}>⚙</button>
          <button className="tree-action-btn" onClick={onSignOut} title="Sign out" style={{ width: 24, height: 24, fontSize: 12 }}>↩</button>
        </div>
      </div>

      {/* Context menu */}
      {ctx && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setCtx(null)} />
          <div className="ctx-menu" style={{ left: ctx.x, top: ctx.y }}>
            {ctx.type === 'folder' && (
              <>
                <div className="ctx-item" onClick={() => startCreate('note', ctx.id)}>📄 New note inside</div>
                <div className="ctx-item" onClick={() => startCreate('folder', ctx.id)}>📁 New subfolder</div>
                <div className="ctx-divider" />
                <div className="ctx-item" onClick={() => { setRenaming({ type: 'folder', id: ctx.id }); setNewName(ctx.name); setCtx(null) }}>✏️ Rename</div>
                <div className="ctx-item danger" onClick={() => deleteFolder(ctx.id)}>🗑 Delete folder</div>
              </>
            )}
            {ctx.type === 'note' && (
              <>
                <div className="ctx-item" onClick={() => { setRenaming({ type: 'note', id: ctx.id, folderId: ctx.folderId }); setNewName(ctx.name); setCtx(null) }}>✏️ Rename</div>
                <div className="ctx-item danger" onClick={() => deleteNote(ctx.id, ctx.folderId)}>🗑 Delete note</div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
