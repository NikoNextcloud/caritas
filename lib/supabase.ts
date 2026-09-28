import { createClient } from '@supabase/supabase-js'
import { auth } from './firebase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://urspuhgjjdhczxuapswz.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_tnE7iqfY5tIvAwBupgw4tQ_R4TZyA4-'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  accessToken: async () => {
    await auth.authStateReady()
    return (await auth.currentUser?.getIdToken(false)) ?? null
  },
  auth: { persistSession: false },
})

