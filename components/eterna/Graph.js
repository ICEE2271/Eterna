'use client'
import { useEffect, useRef, useState } from 'react'

// Category colors - muted so nodes look like glowing orbs
const CAT_COLORS = {
  'Characters': [220, 80, 80],
  'Factions': [220, 140, 60],
  'World & Geography': [60, 120, 220],
  'Artifacts & Weapons': [180, 180, 180],
  'Quests': [200, 180, 60],
  'Creatures & Wildlife': [60, 180, 80],
  'Magic & Skills': [160, 60, 220],
  'Lore & History': [180, 120, 60],
  'Concepts & Systems': [60, 180, 200],
  'Peoples & Cultures': [220, 100, 160],
}

function catColor(cat) {
  if (CAT_COLORS[cat]) return CAT_COLORS[cat]
  let h = 0; for (const c of (cat||'')) h = ((h<<5)-h)+c.charCodeAt(0)
  const hue = Math.abs(h)%360
  const r = Math.round(128+80*Math.cos(hue*Math.PI/180))
  const g = Math.round(128+80*Math.cos((hue+120)*Math.PI/180))
  const b = Math.round(128+80*Math.cos((hue+240)*Math.PI/180))
  return [r,g,b]
}

export default function Graph({ data, onNodeClick, onRefresh }) {
  const canvasRef = useRef(null)
  const simRef = useRef({ nodes:[], edges:[], tick:0 })
  const camRef = useRef({ x:0, y:0, zoom:1 })
  const dragRef = useRef(null) // 'pan' | null
  const lastMouse = useRef({x:0,y:0})
  const hovRef = useRef(null)
  const pulses = useRef([]) // [{edgeIdx, t, speed}]
  const animRef = useRef(null)
  const [tooltip, setTooltip] = useState({v:false,x:0,y:0,text:'',cat:''})
  const [nodeCount, setNodeCount] = useState(0)

  useEffect(() => {
    if (!data?.nodes) return
    setNodeCount(data.nodes.length)
    initSim(data)
  }, [data])

  const initSim = (d) => {
    const nodes = d.nodes.map((n,i) => {
      // Place nodes in a circular layout initially
      const angle = (i / d.nodes.length) * Math.PI * 2
      const r = 150 + Math.random() * 100
      return { ...n, x: Math.cos(angle)*r, y: Math.sin(angle)*r, vx:0, vy:0 }
    })
    simRef.current = { nodes, edges: d.edges||[], tick:0 }
    // Seed initial pulses
    pulses.current = []
    if (d.edges?.length > 0) {
      for (let i = 0; i < Math.min(5, d.edges.length); i++) {
        pulses.current.push({ edgeIdx: Math.floor(Math.random()*d.edges.length), t: Math.random(), speed: 0.003+Math.random()*0.004 })
      }
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(canvas)

    const sim = () => {
      const {nodes, edges, tick} = simRef.current
      if (!nodes.length || tick > 400) return
      const R = 6000, K = 0.04, C = 0.002
      nodes.forEach(n => {
        nodes.forEach(m => {
          if (n===m) return
          const dx=n.x-m.x, dy=n.y-m.y, d2=dx*dx+dy*dy+1
          const f=R/d2; n.vx+=dx*f; n.vy+=dy*f
        })
        n.vx -= n.x*C; n.vy -= n.y*C
        n.vx *= 0.85; n.vy *= 0.85
        n.x += n.vx; n.y += n.vy
      })
      edges.forEach(e => {
        const s=nodes.find(n=>n.id===e.source), t=nodes.find(n=>n.id===e.target)
        if(!s||!t) return
        const dx=t.x-s.x, dy=t.y-s.y, d=Math.sqrt(dx*dx+dy*dy)||1
        const f=(d-100)*K
        const fx=(dx/d)*f, fy=(dy/d)*f
        s.vx+=fx; s.vy+=fy; t.vx-=fx; t.vy-=fy
      })
      simRef.current.tick++
    }

    const toScreen = (wx, wy, w, h) => {
      const cam = camRef.current
      return { sx: (wx + cam.x) * cam.zoom + w/2, sy: (wy + cam.y) * cam.zoom + h/2 }
    }

    const toWorld = (sx, sy, w, h) => {
      const cam = camRef.current
      return { wx: (sx - w/2) / cam.zoom - cam.x, wy: (sy - h/2) / cam.zoom - cam.y }
    }

    const draw = () => {
      const {nodes, edges} = simRef.current
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)

      // Background — near black with slight off-black
      ctx.fillStyle = 'rgba(5,5,8,1)'
      ctx.fillRect(0, 0, w, h)

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.02)'
      ctx.lineWidth = 1
      const gridSize = 60 * camRef.current.zoom
      const offX = (camRef.current.x * camRef.current.zoom + w/2) % gridSize
      const offY = (camRef.current.y * camRef.current.zoom + h/2) % gridSize
      for (let x = offX; x < w; x += gridSize) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }
      for (let y = offY; y < h; y += gridSize) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }

      if (!nodes.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.font = '13px Inter,sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('No notes yet. Create your first note in The Hall.', w/2, h/2)
        animId = requestAnimationFrame(draw)
        return
      }

      sim()

      // Draw edges as glowing strings
      edges.forEach(e => {
        const s = nodes.find(n=>n.id===e.source)
        const t = nodes.find(n=>n.id===e.target)
        if (!s||!t) return
        const sp = toScreen(s.x, s.y, w, h)
        const tp = toScreen(t.x, t.y, w, h)
        // String
        ctx.beginPath()
        ctx.moveTo(sp.sx, sp.sy)
        ctx.lineTo(tp.sx, tp.sy)
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 0.8
        ctx.stroke()
      })

      // Animate pulses along edges
      const aliveP = []
      pulses.current.forEach(p => {
        const e = edges[p.edgeIdx]
        if (!e) return
        const s = nodes.find(n=>n.id===e.source)
        const t = nodes.find(n=>n.id===e.target)
        if (!s||!t) return
        const sp = toScreen(s.x, s.y, w, h)
        const tp = toScreen(t.x, t.y, w, h)
        const px = sp.sx + (tp.sx-sp.sx)*p.t
        const py = sp.sy + (tp.sy-sp.sy)*p.t
        // Pulse dot
        const pg = ctx.createRadialGradient(px,py,0,px,py,5*camRef.current.zoom)
        pg.addColorStop(0,'rgba(255,255,255,0.9)')
        pg.addColorStop(0.4,'rgba(255,255,255,0.4)')
        pg.addColorStop(1,'rgba(255,255,255,0)')
        ctx.beginPath()
        ctx.arc(px, py, 5*camRef.current.zoom, 0, Math.PI*2)
        ctx.fillStyle = pg
        ctx.fill()
        p.t += p.speed
        if (p.t < 1) aliveP.push(p)
        else {
          // Spawn new pulse on random edge
          aliveP.push({ edgeIdx: Math.floor(Math.random()*edges.length), t:0, speed: 0.003+Math.random()*0.004 })
        }
      })
      pulses.current = aliveP

      // Keep pulse count up
      while (pulses.current.length < Math.min(8, edges.length) && edges.length > 0) {
        pulses.current.push({ edgeIdx: Math.floor(Math.random()*edges.length), t:Math.random(), speed:0.003+Math.random()*0.004 })
      }

      // Draw Eterna central orb
      const center = toScreen(0, 0, w, h)
      const cR = 22 * camRef.current.zoom
      const cGrad = ctx.createRadialGradient(center.sx-cR*0.3,center.sy-cR*0.3,0,center.sx,center.sy,cR*2)
      cGrad.addColorStop(0,'rgba(255,255,255,0.95)')
      cGrad.addColorStop(0.3,'rgba(var(--orb-r,255),var(--orb-g,255),var(--orb-b,255),0.7)')
      cGrad.addColorStop(0.6,'rgba(255,255,255,0.15)')
      cGrad.addColorStop(1,'rgba(255,255,255,0)')
      ctx.shadowBlur = 30 * camRef.current.zoom
      ctx.shadowColor = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.arc(center.sx, center.sy, cR, 0, Math.PI*2)
      ctx.fillStyle = cGrad
      ctx.fill()
      ctx.shadowBlur = 0
      // Eterna label
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `${9*camRef.current.zoom}px Cinzel,serif`
      ctx.textAlign = 'center'
      ctx.letterSpacing = '2px'
      ctx.fillText('ETERNA', center.sx, center.sy + cR + 14*camRef.current.zoom)

      // Draw nodes
      nodes.forEach(n => {
        const p = toScreen(n.x, n.y, w, h)
        const isHov = hovRef.current === n.id
        const col = catColor(n.category)
        const baseR = Math.max(4, Math.min(14, 4 + n.degree * 1.5))
        const r = baseR * camRef.current.zoom

        // Glow
        if (isHov || n.degree > 2) {
          ctx.shadowBlur = isHov ? 20 : 10
          ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.8)`
        }

        // Orb gradient
        const g = ctx.createRadialGradient(p.sx-r*0.3, p.sy-r*0.35, 0, p.sx, p.sy, r)
        g.addColorStop(0, 'rgba(255,255,255,0.95)')
        g.addColorStop(0.25, `rgba(${col[0]},${col[1]},${col[2]},0.9)`)
        g.addColorStop(0.7, `rgba(${col[0]},${col[1]},${col[2]},0.4)`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, r, 0, Math.PI*2)
        ctx.fillStyle = g
        ctx.fill()
        ctx.shadowBlur = 0

        // Label for hovered or important nodes
        if (isHov || (n.degree > 3 && camRef.current.zoom > 0.5)) {
          ctx.fillStyle = isHov ? '#fff' : `rgba(${col[0]},${col[1]},${col[2]},0.8)`
          ctx.font = `${isHov?12:10}px Inter,sans-serif`
          ctx.textAlign = 'center'
          const label = n.title?.length > 25 ? n.title.slice(0,23)+'…' : (n.title||'')
          ctx.fillText(label, p.sx, p.sy + r + 12*camRef.current.zoom)
        }
      })

      // Slow auto-rotate
      camRef.current.rotY = (camRef.current.rotY||0) + 0.0003
      animId = requestAnimationFrame(draw)
    }
    draw()

    // Interactions
    const getHov = (mx, my) => {
      const {nodes} = simRef.current
      const w=canvas.width, h=canvas.height
      for (const n of nodes) {
        const p = toScreen(n.x, n.y, w, h)
        const baseR = Math.max(4, Math.min(14, 4+n.degree*1.5)) * camRef.current.zoom
        if (Math.hypot(mx-p.sx, my-p.sy) < baseR+6) return n
      }
      return null
    }

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX-rect.left, my = e.clientY-rect.top
      if (dragRef.current === 'pan') {
        camRef.current.x += (mx - lastMouse.current.x) / camRef.current.zoom
        camRef.current.y += (my - lastMouse.current.y) / camRef.current.zoom
      }
      lastMouse.current = {x:mx, y:my}
      const found = getHov(mx, my)
      hovRef.current = found?.id || null
      if (found) {
        setTooltip({v:true, x:mx+12, y:my-10, text:found.title||'', cat:found.category||''})
        canvas.style.cursor = 'pointer'
      } else {
        setTooltip(t=>({...t,v:false}))
        canvas.style.cursor = dragRef.current ? 'grabbing' : 'grab'
      }
    }

    const onDown = (e) => {
      dragRef.current = 'pan'
      const rect = canvas.getBoundingClientRect()
      lastMouse.current = {x:e.clientX-rect.left, y:e.clientY-rect.top}
      canvas.style.cursor = 'grabbing'
    }

    const onUp = () => { dragRef.current = null; canvas.style.cursor = 'grab' }

    const onClick = async (e) => {
      if (!hovRef.current) return
      const { data } = await (async()=>{
        const db = (await import('../../lib/supabase')).supabase()
        return db.from('hall_notes').select('*').eq('id', hovRef.current).single()
      })()
      if (data && onNodeClick) onNodeClick(data)
    }

    const onWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      camRef.current.zoom = Math.max(0.2, Math.min(4, camRef.current.zoom * factor))
    }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('wheel', onWheel, {passive:false})
    canvas.style.cursor = 'grab'

    return () => {
      cancelAnimationFrame(animId); ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [onNodeClick])

  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      <canvas ref={canvasRef} style={{ width:'100%', height:'100%' }} />
      {/* Stats */}
      <div style={{ position:'absolute', top:12, left:12, fontSize:11, color:'rgba(255,255,255,0.25)', letterSpacing:1 }}>
        {nodeCount} notes
      </div>
      <button onClick={onRefresh} style={{ position:'absolute', top:10, right:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'rgba(255,255,255,0.4)', padding:'4px 10px', cursor:'pointer', fontSize:11 }}>
        ↻ Refresh
      </button>
      {/* Tooltip */}
      {tooltip.v && (
        <div style={{ position:'absolute', left:tooltip.x, top:tooltip.y, background:'rgba(10,10,12,0.95)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 10px', pointerEvents:'none', zIndex:10 }}>
          <div style={{ fontSize:12, color:'#fff' }}>{tooltip.text}</div>
          {tooltip.cat && <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:2, letterSpacing:1 }}>{tooltip.cat.toUpperCase()}</div>}
        </div>
      )}
    </div>
  )
}
