import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { count } = await supabaseAdmin
    .from('support_articles')
    .select('*', { count: 'exact', head: true })
  return NextResponse.json({ count: count ?? 0 })
}
