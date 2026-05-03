'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const COLOR_VARS = [
  { key: '--accent', label: 'Accent color', desc: 'Highlights, active items' },
  { key: '--orb-r', label: 'Orb Red', type: 'rgb', channel: 'r' },
  { key: '--orb-g', label: 'Orb Green', type: 'rgb', channel: 'g' },
  { key: '--orb-b', label: 'Orb Blue', type: 'rgb', channel: 'b' },
  { key: '--pulse-r', label: 'Pulse Red', type: 'rgb', channel: 'r' },
  { key: '--pulse-g', label: 'Pulse Green', type: 'rgb', channel: 'g' },
  { key: '--pulse-b', label: 'Pulse Blue', type: 'rgb', channel: 'b' },
]

const PRESETS = [
  { name: 'White', vars: { '--accent': '#ffffff', '--orb-r': '255', '--orb-g': '255', '--orb-b': '255', '--pulse-r': '255', '--pulse-g': '255', '--pulse-b': '255', '--accent-r': '255', '--accent-g': '255', '--accent-b': '255' } },
  { name: 'Red', vars: { '--accent': '#ff4040', '--orb-r': '255', '--orb-g': '60', '--orb-b': '60', '--pulse-r': '255', '--pulse-g': '100', '--pulse-b': '100', '--accent-r': '255', '--accent-g': '64', '--accent-b': '64' } },
  { name: 'Blue', vars: { '--accent': '#4080ff', '--orb-r': '80', '--orb-g': '140', '--orb-b': '255', '--pulse-r': '100', '--pulse-g': '160', '--pulse-b': '255', '--accent-r': '64', '--accent-g': '128', '--accent-b': '255' } },
  { name: 'Gold', vars: { '--accent': '#d4a030', '--orb-r': '212', '--orb-g': '170', '--orb-b': '60', '--pulse-r': '255', '--pulse-g': '200', '--pulse-b': '80', '--accent-r': '212', '--accent-g': '160', '--accent-b': '48' } },
  { name: 'Green', vars: { '--accent': '#40c060', '--orb-r': '60', '--orb-g': '200', '--orb-b': '100', '--pulse-r': '80', '--pulse-g': '220', '--pulse-b': '120', '--accent-r': '64', '--accent-g': '192', '--accent-b': '96' } },
  { name: 'Violet', vars: { '--accent': '#9060ff', '--orb-r': '160', '--orb-g': '80', '--orb-b': '255', '--pulse-r': '180', '--pulse-g': '100', '--pulse-b': '255', '--accent-r': '144', '--accent-g': '96', '--accent-b': '255' } },
]

export function ColorPicker({ user, onClose }) {
  const [colors, setColors] = useState({})
  const [orbColor, setOrbColor] = useState('#ffffff')
  const db = supabase()

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('eterna_colors') || '{}')
    setColors(saved)
    const r = saved['--orb-r'] || '255', g = saved['--orb-g'] || '255', b = saved['--orb-b'] || '255'
    setOrbColor(`#${parseInt(r).toString(16).padStart(2,'0')}${parseInt(g).toString(16).padStart(2,'0')}${parseInt(b).toString(16).padStart(2,'0')}`)
  }, [])

  const apply = (vars) => {
    const next = { ...colors, ...vars }
    setColors(next)
    Object.entries(vars).forEach(([k,v]) => document.documentElement.style.setProperty(k, v))
    // Update dim
    const r=vars['--accent-r']||colors['--accent-r']||255, g=vars['--accent-g']||colors['--accent-g']||255, b2=vars['--accent-b']||colors['--accent-b']||255
    document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b2},0.08)`)
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b2},0.15)`)
    localStorage.setItem('eterna_colors', JSON.stringify(next))
  }

  const applyOrbPicker = (hex) => {
    setOrbColor(hex)
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
    apply({ '--orb-r': String(r), '--orb-g': String(g), '--orb-b': String(b), '--pulse-r': String(r), '--pulse-g': String(g), '--pulse-b': String(b) })
  }

  const applyAccentPicker = (hex) => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
    apply({ '--accent': hex, '--accent-r': String(r), '--accent-g': String(g), '--accent-b': String(b) })
  }

  const reset = () => {
    localStorage.removeItem('eterna_colors')
    setColors({})
    document.querySelectorAll('[style]').forEach(el => {
      COLOR_VARS.forEach(v => el.style.removeProperty(v.key))
      ;['--accent-r','--accent-g','--accent-b','--accent-dim','--accent-glow'].forEach(k => el.style.removeProperty(k))
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontFamily:'Cinzel,serif', fontSize:14, letterSpacing:3, color:'rgba(255,255,255,0.7)' }}>COLORS</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>

        {/* Presets */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:2, marginBottom:10 }}>PRESETS</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {PRESETS.map(p => (
              <button key={p.name} onClick={() => apply(p.vars)} className="e-btn" style={{ fontSize:11, padding:'4px 12px' }}>{p.name}</button>
            ))}
          </div>
        </div>

        {/* Custom */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:2, marginBottom:12 }}>CUSTOM</div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, color:'var(--text-dim)' }}>Orb & Pulse</span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="color" value={orbColor} onChange={e=>applyOrbPicker(e.target.value)}
                  style={{ width:36, height:28, border:'1px solid var(--border)', borderRadius:4, background:'transparent', cursor:'pointer', padding:2 }} />
                <code style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'JetBrains Mono,monospace' }}>{orbColor}</code>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, color:'var(--text-dim)' }}>Accent</span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="color" value={colors['--accent']||'#ffffff'} onChange={e=>applyAccentPicker(e.target.value)}
                  style={{ width:36, height:28, border:'1px solid var(--border)', borderRadius:4, background:'transparent', cursor:'pointer', padding:2 }} />
                <code style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'JetBrains Mono,monospace' }}>{colors['--accent']||'#ffffff'}</code>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={reset} className="e-btn" style={{ flex:1, fontSize:11 }}>Reset</button>
          <button onClick={onClose} className="e-btn-accent" style={{ flex:1, fontSize:11 }}>Done</button>
        </div>
      </div>
    </div>
  )
}

export default function Settings({ user, onClose, onColorsOpen, inline }) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const [intensity, setIntensity] = useState('standard')
  const db = supabase()

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await db.from('user_settings').select('*').eq('user_id', user.id).single()
    if (data?.display_name) setName(data.display_name)
    if (data?.challenge_intensity) setIntensity(data.challenge_intensity)
  }

  const save = async () => {
    await db.from('user_settings').upsert({ user_id: user.id, display_name: name, challenge_intensity: intensity })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const content = (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <h2 style={{ fontFamily:'Cinzel,serif', fontSize:16, letterSpacing:4, color:'rgba(255,255,255,0.7)', marginBottom:24 }}>SETTINGS</h2>

      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:2, marginBottom:8 }}>YOUR NAME</div>
        <input value={name} onChange={e=>setName(e.target.value)} className="e-input" placeholder="What shall Eterna call you?" />
      </div>

      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:2, marginBottom:8 }}>CHALLENGE INTENSITY</div>
        <div style={{ display:'flex', gap:8 }}>
          {['gentle','standard','rigorous'].map(v=>(
            <button key={v} onClick={()=>setIntensity(v)} className={`tab ${intensity===v?'active':''}`}>{v}</button>
          ))}
        </div>
        <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
          {intensity==='gentle'?'Eterna opens with what works before challenging.':intensity==='standard'?'Honest and direct, like a good editor.':'Eterna pushes hard on every gap and contradiction.'}
        </p>
      </div>

      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:2, marginBottom:8 }}>COLORS</div>
        <button onClick={onColorsOpen} className="e-btn" style={{ fontSize:12 }}>Open Color Picker →</button>
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <button onClick={save} className="e-btn-accent" style={{ padding:'8px 24px', fontSize:12 }}>
          {saved ? '✓ Saved' : 'Save'}
        </button>
        {!inline && <button onClick={onClose} className="e-btn" style={{ padding:'8px 16px', fontSize:12 }}>Close</button>}
      </div>
    </div>
  )

  if (inline) return content
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:520 }}>
        {content}
      </div>
    </div>
  )
}
