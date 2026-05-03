'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [mode, setMode] = useState('land')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const canvasRef = useRef(null)
  const router = useRouter()
  const db = supabase()

  // Check session
  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard')
    })
  }, [])

  // Particle canvas
  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')
    let id, pts = []
    const resize = () => { c.width = innerWidth; c.height = innerHeight }
    resize(); addEventListener('resize', resize)
    for (let i = 0; i < 80; i++) pts.push({ x: Math.random(), y: Math.random(), vx: (Math.random()-.5)*.0002, vy: (Math.random()-.5)*.0002, r: Math.random()*.8+.2 })
    const draw = () => {
      ctx.clearRect(0,0,c.width,c.height)
      pts.forEach(p => {
        p.x+=p.vx; p.y+=p.vy
        if(p.x<0)p.x=1; if(p.x>1)p.x=0; if(p.y<0)p.y=1; if(p.y>1)p.y=0
        ctx.beginPath(); ctx.arc(p.x*c.width,p.y*c.height,p.r,0,Math.PI*2)
        ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.fill()
      })
      pts.forEach((p,i) => pts.slice(i+1).forEach(q => {
        const d=Math.hypot((p.x-q.x)*c.width,(p.y-q.y)*c.height)
        if(d<120){ ctx.beginPath(); ctx.moveTo(p.x*c.width,p.y*c.height); ctx.lineTo(q.x*c.width,q.y*c.height)
          ctx.strokeStyle=`rgba(255,255,255,${0.06*(1-d/120)})`; ctx.lineWidth=.5; ctx.stroke() }
      }))
      id=requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(id); removeEventListener('resize', resize) }
  }, [])

  const signIn = async e => {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await db.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/dashboard')
  }

  const signUp = async e => {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await db.auth.signUp({ email, password, options: { data: { display_name: name } } })
    if (error) { setError(error.message); setLoading(false) }
    else { setMsg('Check your email to confirm, then sign in.'); setLoading(false) }
  }

  const googleAuth = async () => {
    await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/dashboard` } })
  }

  return (
    <div style={{ height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {mode === 'land' && (
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: '0 24px' }}>
          {/* Orb */}
          <div className="eterna-orb" style={{ width: 80, height: 80, margin: '0 auto 32px' }} />
          <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 64, letterSpacing: 16, color: '#fff', marginBottom: 8 }}>ETERNA</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, letterSpacing: 4, marginBottom: 48 }}>YOUR SECOND BRAIN</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => setMode('up')} className="e-btn-accent" style={{ padding: '10px 32px', fontSize: 13, letterSpacing: 2 }}>BEGIN</button>
            <button onClick={() => setMode('in')} className="e-btn" style={{ padding: '10px 32px', fontSize: 13, letterSpacing: 2 }}>RETURN</button>
          </div>
        </div>
      )}

      {(mode === 'in' || mode === 'up') && (
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380, padding: '0 24px' }}>
          <div style={{ background: 'rgba(10,10,10,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, backdropFilter: 'blur(20px)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="eterna-orb" style={{ width: 52, height: 52, margin: '0 auto 16px' }} />
              <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 18, letterSpacing: 4, color: '#fff' }}>
                {mode === 'in' ? 'RETURN' : 'BEGIN'}
              </h2>
            </div>

            {error && <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', borderRadius: 6, padding: '8px 12px', color: '#ff8080', fontSize: 12, marginBottom: 16 }}>{error}</div>}
            {msg && <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 12px', color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 16 }}>{msg}</div>}

            <button onClick={googleAuth} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <form onSubmit={mode === 'in' ? signIn : signUp} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mode === 'up' && <input className="e-input" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />}
              <input className="e-input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
              <input className="e-input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
              <button type="submit" disabled={loading} className="e-btn-accent" style={{ padding: '10px', fontSize: 12, letterSpacing: 2, marginTop: 4 }}>
                {loading ? '...' : mode === 'in' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              {mode === 'in' ? "Don't have an account? " : 'Already have one? '}
              <button onClick={() => { setMode(mode==='in'?'up':'in'); setError(''); setMsg('') }} style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                {mode === 'in' ? 'Sign up' : 'Sign in'}
              </button>
            </p>

            <button onClick={() => setMode('land')} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          </div>
        </div>
      )}
    </div>
  )
}
