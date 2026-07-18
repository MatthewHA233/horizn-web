import 'server-only'

import { createClient } from '@supabase/supabase-js'

let client = null

export function getSupabaseAdmin() {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !serviceKey) throw new Error('Supabase 服务端配置缺失')

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
