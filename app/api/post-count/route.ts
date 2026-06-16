import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { count } = await supabaseAdmin
    .from('posts')
    .select('*', { count: 'exact', head: true })
  return NextResponse.json({ count: count ?? 0 })
}
