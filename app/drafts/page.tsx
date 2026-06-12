import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

const C = {
  bg:       '#f5f5f7',
  surface:  '#ffffff',
  border:   '#e4e4e9',
  text:     '#111118',
  textSub:  '#6b6b80',
  textMuted:'#9999aa',
  accent:   '#6c63ff',
  topBar:   '#1a1a2e',
  sans:     '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  grad:     'linear-gradient(135deg,#FFB347 0%,#FF7B8B 35%,#CC80E0 65%,#5CE8D4 100%)',
}

export default async function DraftsPage() {
  const { data: drafts } = await supabaseAdmin
    .from('generated_drafts')
    .select('id, title, slug, meta_description, input_topic, input_audience, input_keywords, created_at, body_draft')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div style={{ fontFamily: C.sans, background: C.bg, minHeight: '100vh' }}>
      <style>{`.draft-row { transition: border-color 0.15s; } .draft-row:hover { border-color: ${C.accent} !important; }`}</style>

      <style>{`.nav-link { opacity: 0.65; transition: opacity 0.15s; } .nav-link:hover { opacity: 1; }`}</style>
      {/* Top bar */}
      <div style={{ background: C.topBar, padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, borderBottom: '3px solid transparent', borderImage: C.grad + ' 1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: C.grad, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', fontWeight: 700 }}>✦</div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>ThingLink Blog Writer</span>
            <span style={{ fontSize: 13, color: '#a09af0', fontWeight: 400, marginLeft: 8 }}>/ Drafts</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/generate" className="nav-link" style={{ fontSize: 13, color: '#fff', textDecoration: 'none', fontWeight: 500 }}>+ New draft</a>
          <a href="/ingest" className="nav-link" style={{ fontSize: 13, color: '#fff', textDecoration: 'none', fontWeight: 500 }}>Archive</a>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>All drafts</h1>
          <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{drafts?.length ?? 0} drafts</span>
        </div>

        {!drafts || drafts.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: C.textSub, margin: '0 0 16px' }}>No drafts yet.</p>
            <a href="/generate" style={{ fontSize: 13, color: C.accent, textDecoration: 'none', fontWeight: 500 }}>Generate your first draft →</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {drafts.map(draft => {
              const date = new Date(draft.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              const wordCount = draft.body_draft?.split(/\s+/).filter(Boolean).length ?? 0

              return (
                <Link key={draft.id} href={`/draft/${draft.id}`} style={{ textDecoration: 'none' }}>
                  <div className="draft-row" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 500, color: C.text, margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {draft.title || '(Untitled)'}
                        </p>
                        {draft.meta_description && (
                          <p style={{ fontSize: 13, color: C.textSub, margin: '0 0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {draft.meta_description}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {draft.input_topic && (
                            <span style={{ fontSize: 11, color: C.textMuted }}>Topic: <span style={{ color: C.textSub }}>{draft.input_topic}</span></span>
                          )}
                          {draft.input_audience && (
                            <span style={{ fontSize: 11, color: C.textMuted }}>Audience: <span style={{ color: C.textSub }}>{draft.input_audience}</span></span>
                          )}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 4px' }}>{date}</p>
                        <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>{wordCount.toLocaleString()} words</p>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
