import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { marked } from 'marked'
import CopyBox from './CopyBox'

const C = {
  bg:       '#f5f5f7',
  surface:  '#ffffff',
  border:   '#e4e4e9',
  text:     '#111118',
  textSub:  '#6b6b80',
  textMuted:'#9999aa',
  accent:   '#6c63ff',
  topBar:   '#1a1a2e',
  mono:     'ui-monospace, SFMono-Regular, Menlo, monospace',
  sans:     '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: draft, error } = await supabaseAdmin
    .from('generated_drafts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !draft) notFound()

  const bodyHtml = marked.parse(draft.body_draft || '') as string

  const createdAt = new Date(draft.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ fontFamily: C.sans, background: C.bg, minHeight: '100vh' }}>

      {/* Top bar */}
      <div style={{ background: C.topBar, padding: '0 32px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', fontWeight: 700 }}>✦</div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>ThingLink Blog Writer <span style={{ color: '#a09af0', fontWeight: 400 }}>/ Draft review</span></span>
        </div>
        <span style={{ fontSize: 12, color: '#a0a0b8' }}>Generated {createdAt}</span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

        {/* Title & slug */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: '0 0 8px', lineHeight: 1.3 }}>{draft.title}</h1>
          <p style={{ fontSize: 12, fontFamily: C.mono, color: C.accent, margin: 0 }}>thinglink.com/blog/{draft.slug}</p>
        </div>

        {/* Brief summary */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, margin: '0 0 10px' }}>Brief</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
            {[
              { label: 'Topic', value: draft.input_topic },
              { label: 'Audience', value: draft.input_audience },
              { label: 'Keywords', value: draft.input_keywords },
              draft.input_notes && { label: 'Notes', value: draft.input_notes },
            ].filter(Boolean).map((item: any, i: number) => (
              <div key={i}>
                <span style={{ fontSize: 11, color: C.textMuted }}>{item.label}: </span>
                <span style={{ fontSize: 12, color: C.text }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Meta description */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, margin: 0 }}>Meta description</p>
            <span style={{ fontSize: 11, fontFamily: C.mono, color: draft.meta_description?.length > 160 ? '#c0392b' : '#27ae60' }}>{draft.meta_description?.length}/160</span>
          </div>
          <p style={{ fontSize: 14, color: C.text, margin: 0, lineHeight: 1.5 }}>{draft.meta_description}</p>
        </div>

        {/* Heading structure */}
        {draft.headings_plan?.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, margin: '0 0 12px' }}>Heading structure</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {draft.headings_plan.map((h: { level: string; text: string }, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: h.level === 'h3' ? 20 : 0 }}>
                  <span style={{ fontSize: 10, fontFamily: C.mono, color: C.accent, background: '#6c63ff14', border: '1px solid #6c63ff33', padding: '2px 6px', borderRadius: 4, minWidth: 30, textAlign: 'center', flexShrink: 0 }}>{h.level.toUpperCase()}</span>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: h.level === 'h2' ? 500 : 400 }}>{h.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body draft — rendered preview */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, margin: '0 0 16px' }}>Body draft — preview</p>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: bodyHtml }} suppressHydrationWarning />
        </div>

        {/* HTML to paste into WordPress */}
        <CopyBox html={bodyHtml} border={C.border} bg={C.bg} textMuted={C.textMuted} textSub={C.textSub} mono={C.mono} surface={C.surface} />

        {/* LinkedIn */}
        {draft.linkedin_post && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, margin: '0 0 10px' }}>LinkedIn post</p>
            <p style={{ fontSize: 14, color: C.text, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{draft.linkedin_post}</p>
          </div>
        )}

        {/* Email teaser */}
        {draft.email_teaser && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, margin: '0 0 10px' }}>Email teaser</p>
            <p style={{ fontSize: 14, color: C.text, margin: 0, lineHeight: 1.6 }}>{draft.email_teaser}</p>
          </div>
        )}

        {/* CTAs */}
        {draft.cta_suggestions?.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted, margin: '0 0 10px' }}>Call to action suggestions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {draft.cta_suggestions.map((cta: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: C.accent }}>→</span>
                  <span style={{ fontSize: 13, color: C.text }}>{cta}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 40 }}>Generated by ThingLink Blog Writer · {createdAt}</p>
      </div>
    </div>
  )
}
