import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {}

  // 1. Check env vars
  checks.anthropic_key = {
    ok: !!process.env.ANTHROPIC_API_KEY,
    detail: process.env.ANTHROPIC_API_KEY ? 'Set' : 'MISSING — add ANTHROPIC_API_KEY in Vercel env vars',
  }
  checks.openai_key = {
    ok: !!process.env.OPENAI_API_KEY,
    detail: process.env.OPENAI_API_KEY ? 'Set' : 'MISSING — add OPENAI_API_KEY in Vercel env vars (needed for vector search)',
  }
  checks.supabase_url = {
    ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    detail: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'MISSING — add NEXT_PUBLIC_SUPABASE_URL',
  }
  checks.supabase_service_key = {
    ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    detail: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'MISSING — add SUPABASE_SERVICE_ROLE_KEY',
  }

  // 2. Check Supabase tables
  for (const table of ['posts', 'examples', 'generated_drafts']) {
    try {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
      if (error) throw error
      checks[`table_${table}`] = { ok: true, detail: `${count ?? 0} rows` }
    } catch (err: any) {
      checks[`table_${table}`] = { ok: false, detail: err.message }
    }
  }

  // 3. Check RPCs
  for (const rpc of ['match_posts', 'match_examples']) {
    try {
      const { error } = await supabaseAdmin.rpc(rpc, {
        query_embedding: Array(1536).fill(0),
        match_count: 1,
      })
      if (error && error.message.includes('does not exist')) {
        checks[`rpc_${rpc}`] = { ok: false, detail: `RPC not found — run the pgvector SQL in Supabase` }
      } else {
        checks[`rpc_${rpc}`] = { ok: true, detail: 'Found' }
      }
    } catch (err: any) {
      checks[`rpc_${rpc}`] = { ok: false, detail: err.message }
    }
  }

  const allOk = Object.values(checks).every(c => c.ok)
  const critical = ['anthropic_key', 'supabase_url', 'supabase_service_key']
  const criticalOk = critical.every(k => checks[k]?.ok)

  return NextResponse.json({ ok: allOk, critical_ok: criticalOk, checks }, { status: allOk ? 200 : 207 })
}
