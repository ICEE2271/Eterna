import { serverSupabase } from '../../../lib/supabase-server'

export async function GET(req) {
  const supabase = await serverSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'graph') {
    const { data: notes } = await supabase.from('hall_notes').select('id,title,folder_id,content').eq('user_id', user.id)
    const { data: folders } = await supabase.from('hall_folders').select('id,name').eq('user_id', user.id)
    if (!notes?.length) return Response.json({ nodes: [], edges: [] })

    const folderMap = new Map((folders||[]).map(f=>[f.id,f.name]))
    const titleMap = new Map(notes.map(n=>[n.title.toLowerCase(),n.id]))
    const degree = new Map(notes.map(n=>[n.id,0]))
    const edges = []

    notes.forEach(n => {
      const matches = (n.content||'').match(/\[\[([^\[\]\n]+?)\]\]/g)||[]
      matches.forEach(m => {
        const target = m.slice(2,-2).split('|')[0].trim().toLowerCase()
        const targetId = titleMap.get(target)
        if (targetId && targetId !== n.id) {
          edges.push({ source: n.id, target: targetId })
          degree.set(n.id, (degree.get(n.id)||0)+1)
          degree.set(targetId, (degree.get(targetId)||0)+1)
        }
      })
    })

    const nodes = notes.map(n => ({
      id: n.id, title: n.title,
      category: folderMap.get(n.folder_id) || 'Uncategorized',
      degree: degree.get(n.id)||0
    }))

    return Response.json({ nodes, edges })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
