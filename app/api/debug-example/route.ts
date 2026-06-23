import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { embed } from '@/lib/openai'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Check raw examples table columns
    const { data: raw, error: rawErr } = await supabaseAdmin
      .from('examples')
      .select('*')
      .limit(1)

    if (rawErr) return NextResponse.json({ error: 'Table query failed', detail: rawErr.message })

    const firstRow = raw?.[0] || null
    const columns = firstRow ? Object.keys(firstRow) : []

    // 2. Try match_examples RPC with a real embedding
    const queryEmbedding = await embed('workplace safety training immersive learning')
    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('match_examples', {
      query_embedding: queryEmbedding,
      match_count: 3,
    })

    return NextResponse.json({
      table_columns: columns,
      first_row_keys: firstRow ? Object.keys(firstRow) : [],
      has_embed_code: firstRow ? ('embed_code' in firstRow) : false,
      has_embed_hyphen: firstRow ? ('embed-code' in firstRow) : false,
      rpc_error: rpcErr?.message || null,
      rpc_results: rpcData?.slice(0, 2) || [],
      rpc_result_keys: rpcData?.[0] ? Object.keys(rpcData[0]) : [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
