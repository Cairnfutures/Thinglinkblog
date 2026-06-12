import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import DraftEditor from './DraftEditor'

const C = {
  topBar: '#1a1a2e',
  accent: '#6c63ff',
  sans:   '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  grad:   'linear-gradient(135deg,#FFB347 0%,#FF7B8B 35%,#CC80E0 65%,#5CE8D4 100%)',
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
      <style>{`.nav-link { opacity: 0.65; transition: opacity 0.15s; } .nav-link:hover { opacity: 1; }`}</style>

      {/* Top bar */}
      <div style={{ background: C.topBar, padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, borderBottom: '3px solid transparent', borderImage: C.grad + ' 1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: C.grad, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', fontWeight: 700 }}>✦</div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>ThingLink Blog Writer</span>
            <span style={{ fontSize: 13, color: '#a09af0', fontWeight: 400, marginLeft: 8 }}>/ Draft review</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/drafts" className="nav-link" style={{ fontSize: 13, color: '#fff', textDecoration: 'none', fontWeight: 500 }}>All drafts</a>
          <a href="/generate" className="nav-link" style={{ fontSize: 13, color: '#fff', textDecoration: 'none', fontWeight: 500 }}>+ New draft</a>
          <span style={{ fontSize: 12, color: '#a0a0b8' }}>Generated {createdAt}</span>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

        {/* Brief summary */}
        <div style={{ background: '#fff', border: '1px solid #e4e4e9', borderRadius: 12, padding: '18px 22px', marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9999aa', margin: '0 0 12px' }}>Brief</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            {[
              { label: 'Topic', value: draft.input_topic },
              { label: 'Audience', value: draft.input_audience },
              { label: 'Keywords', value: draft.input_keywords },
              draft.input_notes ? { label: 'Notes', value: draft.input_notes } : null,
            ].filter(Boolean).map((item: any, i: number) => (
              <div key={i}>
                <span style={{ fontSize: 12, color: '#9999aa', fontWeight: 500 }}>{item.label}: </span>
                <span style={{ fontSize: 14, color: '#111118' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <DraftEditor draft={draft} createdAt={createdAt} />
      </div>
    </div>
  )
}
