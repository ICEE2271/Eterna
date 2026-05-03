import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function serverSupabase() {
  const jar = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookies: { getAll: () => jar.getAll(), setAll: (s) => { try { s.forEach(({ name, value, options }) => jar.set(name, value, options)) } catch {} } } }
  )
}
