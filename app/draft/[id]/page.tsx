import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import DraftEditor from './DraftEditor'

const C = {
  topBar: '#1a1a2e',
  accent: '#6c63ff',
  sans:   '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: draft, error } = await supabaseAdmin
    .from('generated_drafts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !draft) notFound()

  const createdAt = new Date(draft.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ fontFamily: C.sans, background: '#f5f5f7', minHeight: '100vh' }}>

      {/* Top bar */}
      <div style={{ background: C.topBar, padding: '0 32px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', fontWeight: 700 }}>✦</div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>ThingLink Blog Writer <span style={{ color: '#a09af0', fontWeight: 400 }}>/ Draft review</span></span>
        </div>
        <span style={{ fontSize: 12, color: '#a0a0b8' }}>Generated {createdAt}</span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

        {/* Brief summary */}
        <div style={{ background: '#fff', border: '1px solid #e4e4e9', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9999aa', margin: '0 0 10px' }}>Brief</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
            {[
              { label: 'Topic', value: draft.input_topic },
              { label: 'Audience', value: draft.input_audience },
              { label: 'Keywords', value: draft.input_keywords },
              draft.input_notes ? { label: 'Notes', value: draft.input_notes } : null,
            ].filter(Boolean).map((item: any, i: number) => (
              <div key={i}>
                <span style={{ fontSize: 12, color: '#9999aa' }}>{item.label}: </span>
                <span style={{ fontSize: 13, color: '#111118' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <DraftEditor draft={draft} createdAt={createdAt} />
      </div>
    </div>
  )
}
