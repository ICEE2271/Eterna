'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function Editor({ note, onClose, onNoteChange, onOpenNote, onGraphRefresh }) {
  const [title, setTitle] = useState(note.title || '')
  const [content, setContent] = useState(note.content || '')
  const [preview, setPreview] = useState(false)
  const [saved, setSaved] = useState(true)
  const [backlinks, setBacklinks] = useState([])
  const [allNotes, setAllNotes] = useState([])
  const [ac, setAc] = useState({ open: false, items: [], query: '', idx: 0 })
  const editorRef = useRef(null)
  const saveTimer = useRef(null)
  const db = supabase()

  useEffect(() => {
    setTitle(note.title || '')
    setContent(note.content || '')
    loadMeta()
  }, [note.id])

  const loadMeta = async () => {
    const [{ data: allN }, { data: bl }] = await Promise.all([
      db.from('hall_notes').select('id,title').order('title'),
      db.from('hall_notes').select('id,title').ilike('content', `%[[${note.title}]]%`).neq('id', note.id)
    ])
    setAllNotes(allN || [])
    setBacklinks(bl || [])
  }

  const save = async (t, c) => {
    await db.from('hall_notes').update({ title: t, content: c, updated_at: new Date().toISOString() }).eq('id', note.id)
    setSaved(true)
    onNoteChange({ ...note, title: t, content: c })
    onGraphRefresh?.()
  }

  const schedule = (t, c) => {
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(t, c), 700)
  }

  const handleContent = (e) => {
    const v = e.target.value
    setContent(v)
    schedule(title, v)
    checkAc(e.target)
  }

  const checkAc = (el) => {
    const pos = el.selectionStart
    const before = el.value.slice(0, pos)
    const open = before.lastIndexOf('[[')
    if (open === -1 || before.slice(open).includes(']]') || before.slice(open).includes('\n')) { setAc(a=>({...a,open:false})); return }
    const q = before.slice(open+2)
    const items = allNotes.filter(n => n.title.toLowerCase().includes(q.toLowerCase()) && n.id !== note.id).slice(0, 8)
    setAc({ open: true, items, query: q, idx: 0 })
  }

  const acceptAc = (idx) => {
    const item = ac.items[idx]; if (!item) return
    const el = editorRef.current
    const pos = el.selectionStart
    const text = el.value
    const before = text.slice(0, pos)
    const openIdx = before.lastIndexOf('[[')
    const after = text.slice(pos)
    const closer = after.startsWith(']]') ? '' : ']]'
    const newContent = before.slice(0, openIdx) + `[[${item.title}${closer}` + after
    setContent(newContent)
    schedule(title, newContent)
    setAc(a=>({...a,open:false}))
    setTimeout(() => { el.selectionStart = el.selectionEnd = openIdx+2+item.title.length+closer.length; el.focus() }, 10)
  }

  const handleKeyDown = (e) => {
    if (!ac.open) return
    if (e.key==='ArrowDown'){e.preventDefault();setAc(a=>({...a,idx:(a.idx+1)%a.items.length}))}
    else if (e.key==='ArrowUp'){e.preventDefault();setAc(a=>({...a,idx:(a.idx-1+a.items.length)%a.items.length}))}
    else if (e.key==='Enter'||e.key==='Tab'){e.preventDefault();acceptAc(ac.idx)}
    else if (e.key==='Escape'){setAc(a=>({...a,open:false}))}
  }

  const renderPreview = () => {
    const wikiLinks = new Map(allNotes.map(n=>[n.title.toLowerCase(),n]))
    let html = content
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\[\[([^\[\]\n]+?)\]\]/g,(_,inner)=>{
        const [target,alias]=inner.split('|'); const disp=alias||target
        const found=wikiLinks.get(target.trim().toLowerCase())
        return `<a class="wiki ${found?'':'broken'}" data-id="${found?.id||''}">${disp}</a>`
      })
      .replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
      .replace(/^---$/gm,'<hr>')
      .replace(/\n/g,'<br>')
    return html
  }

  // Markdown toolbar helpers
  const wrap = (before, after='') => {
    const el = editorRef.current; if(!el) return
    const s=el.selectionStart, e2=el.selectionEnd
    const sel=content.slice(s,e2)||'text'
    const newC=content.slice(0,s)+before+sel+after+content.slice(e2)
    setContent(newC); schedule(title,newC)
    setTimeout(()=>{el.selectionStart=s+before.length;el.selectionEnd=s+before.length+sel.length;el.focus()},10)
  }

  const insertLine = (prefix) => {
    const el = editorRef.current; if(!el) return
    const pos=el.selectionStart
    const before=content.slice(0,pos)
    const after=content.slice(pos)
    const lineStart=before.lastIndexOf('\n')+1
    const newC=before.slice(0,lineStart)+prefix+before.slice(lineStart)+after
    setContent(newC); schedule(title,newC)
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Toolbar */}
      <div style={{ padding:'8px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <button className="tree-action-btn" onClick={onClose} style={{ marginRight:8, fontSize:12, color:'var(--text-dim)' }}>← Back</button>
        <input value={title} onChange={e=>{setTitle(e.target.value);schedule(e.target.value,content)}}
          style={{ flex:1, background:'none', border:'none', color:'rgba(255,255,255,0.8)', fontSize:15, fontFamily:'Cinzel,serif', outline:'none', letterSpacing:1, minWidth:100 }}
          placeholder="Note title..." />
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <span style={{ fontSize:10, color:'var(--text-muted)' }}>{saved?'✓ Saved':'Saving...'}</span>
          <div style={{ width:1, height:16, background:'var(--border)', margin:'0 6px' }} />
          {/* Formatting buttons */}
          {[['B','**','**'],['I','*','*'],['~~','~~']].map(([l,b,a])=>(
            <button key={l} onClick={()=>wrap(b,a)} className="tree-action-btn" style={{fontSize:11,width:24,height:24,fontWeight:l==='B'?'bold':'normal',fontStyle:l==='I'?'italic':'normal'}}>{l}</button>
          ))}
          {[['H1','# '],['H2','## '],['H3','### '],['—','- '],['1.','1. '],['> ','> ']].map(([l,p])=>(
            <button key={l} onClick={()=>insertLine(p)} className="tree-action-btn" style={{fontSize:10,width:24,height:24}}>{l}</button>
          ))}
          <div style={{width:1,height:16,background:'var(--border)',margin:'0 4px'}}/>
          <button onClick={()=>setPreview(!preview)} className={`e-btn ${preview?'e-btn-accent':''}`} style={{fontSize:11,padding:'3px 10px'}}>
            {preview?'Edit':'Preview'}
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      <div style={{ flex:1, overflow:'hidden', position:'relative', display:'flex' }}>
        {!preview ? (
          <div style={{ flex:1, position:'relative' }}>
            <textarea ref={editorRef} value={content} onChange={handleContent} onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(()=>setAc(a=>({...a,open:false})),150)}
              placeholder="Begin writing... Use [[Note Name]] to link notes."
              style={{ width:'100%', height:'100%', background:'transparent', border:'none', outline:'none', padding:'24px 28px', color:'rgba(255,255,255,0.85)', fontSize:14, fontFamily:'Inter,sans-serif', lineHeight:1.8, resize:'none', scrollbarWidth:'thin' }}
            />
            {/* Autocomplete */}
            {ac.open && ac.items.length > 0 && (
              <div style={{ position:'absolute', left:80, top:60, background:'var(--raised)', border:'1px solid var(--border-hover)', borderRadius:8, overflow:'hidden', zIndex:20, minWidth:200 }}>
                {ac.items.map((item,i)=>(
                  <div key={item.id} onMouseDown={()=>acceptAc(i)}
                    style={{ padding:'7px 12px', cursor:'pointer', fontSize:12, color:i===ac.idx?'#fff':'var(--text-dim)', background:i===ac.idx?'rgba(255,255,255,0.08)':'transparent' }}>
                    {item.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="md" style={{ flex:1, padding:'24px 28px', overflowY:'auto', fontSize:14, lineHeight:1.8 }}
            dangerouslySetInnerHTML={{ __html: renderPreview() }}
            onClick={e => { const a=e.target.closest('a.wiki'); if(a?.dataset.id) { const n=allNotes.find(n=>n.id===a.dataset.id); if(n)onOpenNote(n) } }} />
        )}
      </div>

      {/* Backlinks */}
      {backlinks.length > 0 && (
        <div style={{ padding:'10px 20px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:2 }}>LINKED FROM</span>
          {backlinks.map(b=>(
            <button key={b.id} onClick={()=>onOpenNote(b)}
              style={{ fontSize:12, color:'rgba(255,255,255,0.5)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>
              {b.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
