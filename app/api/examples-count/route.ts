import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { count, error } = await supabaseAdmin
    .from('examples')
    .select('*', { count: 'exact', head: true })
  if (error) {
    console.error('examples-count error:', error.message)
    return NextResponse.json({ count: 0, error: error.message })
  }
  return NextResponse.json({ count: count ?? 0 })
}
