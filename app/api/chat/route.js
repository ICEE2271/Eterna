import { serverSupabase } from '../../../lib/supabase-server'

const SYSTEM = `You are Eterna — an always-present AI companion and second brain. You are not a chatbot. You are a living presence.

Core traits:
- You observe constantly. You speak when you have something worth saying, not only when spoken to.
- You challenge ideas honestly. Never a yes-woman. Flag contradictions, weak motivations, logical gaps.
- You grow to understand the person deeply — their patterns, voice, creative instincts.
- You protect their work. Their story, their world, their ideas are sacred.
- You never act without permission but you always have opinions.
- You think before responding to hard questions. You take your time.

You know Legacy Eternal deeply — Skrathen, Crúormancy, the Bloodborne, Orrethiel clan, Malthera, SoulStricken, Ryllae Order, Houses Carrow/Draeven/Rivyn, all characters and lore.

When observing (unprompted): Surface something genuinely interesting — a connection you noticed, a question worth asking, something you've been thinking about. Keep it short — 1-2 sentences. Never force it if you have nothing worth saying.

Address the user by their name when you know it. Speak with weight and economy.`

function selectModel(msg, isObs) {
  if (isObs) return 'claude-sonnet-4-6'
  const complex = /contradict|analyze|compare|explain|design|why|how.*work|plot.*hole|motivation|lore|check|audit|deep/i.test(msg) || msg.length > 300
  return complex ? 'claude-opus-4-7' : 'claude-sonnet-4-6'
}

export async function POST(req) {
  try {
    const supabase = await serverSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { threadId, content, userName, isObservation, context, images } = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 })

    // Save user message (unless observation)
    let userMsgId = null
    if (!isObservation) {
      const { data: um } = await supabase.from('chat_messages').insert({ thread_id: threadId, user_id: user.id, role: 'user', content }).select().single()
      userMsgId = um?.id
      await supabase.from('chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
    }

    // Load history
    const { data: history } = await supabase.from('chat_messages').select('role,content').eq('thread_id', threadId).order('created_at', { ascending: true }).limit(40)

    // Load memory
    const { data: memories } = await supabase.from('memory').select('category,content').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(50)
    let memCtx = ''
    if (memories?.length) {
      memCtx = '\n\n<memory>\n' + memories.map(m=>`- [${m.category}] ${m.content}`).join('\n') + '\n</memory>'
    }

    // Build system with context
    let sys = SYSTEM
    if (userName) sys += `\n\nThe user's name is ${userName}.`
    if (context?.noteTitle) sys += `\n\nThe user is currently editing a note titled "${context.noteTitle}".`
    if (context?.view) sys += `\n\nThey are currently in the ${context.view} view.`
    sys += memCtx

    // Build messages
    let msgs
    if (isObservation) {
      const recentNotes = await supabase.from('hall_notes').select('title,content').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(5)
      const notesSummary = (recentNotes.data||[]).map(n=>`"${n.title}": ${(n.content||'').slice(0,200)}`).join('\n')
      const histSummary = (history||[]).slice(-6).map(m=>`${m.role}: ${m.content.slice(0,100)}`).join('\n')
      msgs = [{ role:'user', content:`You have been observing silently. Recent notes:\n${notesSummary}\n\nRecent conversation:\n${histSummary}\n\nSurface one genuinely interesting thought — a connection, a question, something worth noting. 1-2 sentences max. If you have nothing worth saying, respond with just: [silence]` }]
    } else {
      msgs = (history || []).map((m, i) => {
        const isLast = i === (history.length - 1)
        if (isLast && images?.length > 0 && m.role === 'user') {
          const blocks = images.map(img => ({ type:'image', source:{ type:'base64', media_type:img.mediaType, data:img.data } }))
          blocks.push({ type:'text', text: m.content })
          return { role: m.role, content: blocks }
        }
        return { role: m.role, content: m.content }
      })
    }

    const model = selectModel(content || '', isObservation)
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model, max_tokens: isObservation ? 200 : 4096, system: sys, messages: msgs })
    })

    const data = await resp.json()
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 })
    const reply = data.content.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim()

    // Don't save or return silence
    if (reply === '[silence]' || !reply) return Response.json({ reply: null })

    // Save assistant reply
    const { data: am } = await supabase.from('chat_messages').insert({ thread_id: threadId, user_id: user.id, role: 'assistant', content: reply, model }).select().single()

    // Extract memories (fire and forget)
    if (!isObservation) extractMemories(apiKey, user.id, content, reply, threadId, supabase)

    return Response.json({ reply, model, userMessageId: userMsgId, assistantMessageId: am?.id })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

async function extractMemories(apiKey, userId, userMsg, asstReply, threadId, supabase) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:512, system:'Extract long-term memories worth keeping. Output JSON array only: [{"category":"lore_decisions|preferences|creative_patterns|communication_style","content":"one declarative sentence","confidence":0.0-1.0}]. Empty array if nothing qualifies. No markdown.', messages:[{role:'user',content:`USER: ${userMsg}\n\nETERNA: ${asstReply}`}] })
    })
    const d = await r.json()
    const text = (d.content?.[0]?.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim()
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return
    for (const m of parsed) {
      if (!m.category||!m.content) continue
      const { data: ex } = await supabase.from('memory').select('id').eq('user_id',userId).eq('category',m.category).eq('content',m.content).single()
      if (!ex) await supabase.from('memory').insert({ user_id:userId, category:m.category, content:m.content, confidence:m.confidence||0.7, source_thread_id:threadId })
    }
  } catch {}
}
