'use client'

import { useState, useMemo } from 'react'
import { marked } from '@/lib/marked'

const C = {
  bg:       '#f5f5f7',
  surface:  '#ffffff',
  border:   '#e4e4e9',
  text:     '#111118',
  textSub:  '#6b6b80',
  textMuted:'#9999aa',
  accent:   '#6c63ff',
  mono:     'ui-monospace, SFMono-Regular, Menlo, monospace',
  sans:     '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  grad:     'linear-gradient(135deg,#FFB347 0%,#FF7B8B 35%,#CC80E0 65%,#5CE8D4 100%)',
}

const field: React.CSSProperties = {
  width: '100%', border: `1px solid ${C.border}`, borderRadius: 8,
  padding: '10px 14px', fontSize: 15, color: C.text, background: C.surface,
  outline: 'none', resize: 'none' as const, fontFamily: C.sans,
  boxSizing: 'border-box' as const, lineHeight: 1.6,
}

const card: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 12, padding: '20px 24px', marginBottom: 16,
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const,
  letterSpacing: '0.08em', color: C.textMuted, display: 'block', marginBottom: 10,
}

function CopyButton({ getText, text = '⎘ Copy' }: { getText: () => string; text?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(getText()); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ fontSize: 12, padding: '5px 14px', border: `1px solid ${C.border}`, borderRadius: 6, color: C.textSub, background: C.bg, cursor: 'pointer', fontFamily: C.sans, fontWeight: 500 }}>
      {copied ? '✓ Copied' : text}
    </button>
  )
}

interface Props { draft: any; createdAt: string }
type Tab = 'preview' | 'content' | 'html'

export default function DraftEditor({ draft, createdAt }: Props) {
  const [title, setTitle] = useState(draft.title || '')
  const [slug, setSlug] = useState(draft.slug || '')
  const [metaDescription, setMetaDescription] = useState(draft.meta_description || '')
  const [body, setBody] = useState(draft.body_draft || '')
  const [linkedinPost, setLinkedinPost] = useState(draft.linkedin_post || '')
  const [emailTeaser, setEmailTeaser] = useState(draft.email_teaser || '')
  const [tab, setTab] = useState<Tab>('preview')

  const htmlBody = useMemo(() => marked.parse(body) as string, [body])

  const tabs = [
    { id: 'preview' as Tab, label: 'Preview' },
    { id: 'content' as Tab, label: 'Markdown' },
    { id: 'html' as Tab, label: 'HTML for WordPress' },
  ]

  return (
    <div style={{ fontFamily: C.sans }}>

      {/* Title & slug */}
      <div style={{ marginBottom: 22 }}>
        <input value={title} onChange={e => setTitle(e.target.value)}
          style={{ ...field, fontSize: 26, fontWeight: 700, border: 'none', borderBottom: `1px solid ${C.border}`, borderRadius: 0, padding: '0 0 12px', marginBottom: 10, letterSpacing: '-0.02em' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 13, fontFamily: C.mono, color: C.textMuted }}>thinglink.com/blog/</span>
          <input value={slug} onChange={e => setSlug(e.target.value)}
            style={{ ...field, fontSize: 13, fontFamily: C.mono, color: C.accent, border: 'none', padding: 0, fontWeight: 600 }} />
        </div>
      </div>

      {/* Meta description */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={sectionLabel}>Meta description</span>
          <span style={{ fontSize: 12, fontFamily: C.mono, color: metaDescription.length > 160 ? '#c0392b' : '#27ae60', fontWeight: 600 }}>{metaDescription.length}/160</span>
        </div>
        <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={2} style={field} />
      </div>

      {/* Body — tabs */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 3 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  padding: '6px 16px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                  color: tab === t.id ? '#fff' : C.textSub,
                  background: tab === t.id ? C.grad : 'transparent',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: C.sans, transition: 'all 0.2s',
                }}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'html' && <CopyButton getText={() => htmlBody} text='⎘ Copy HTML' />}
          {tab === 'content' && <CopyButton getText={() => body} text='⎘ Copy markdown' />}
        </div>

        <div>
          {tab === 'preview' && (
            <div style={{ fontSize: 15, color: C.text, lineHeight: 1.85 }} dangerouslySetInnerHTML={{ __html: htmlBody }} suppressHydrationWarning />
          )}
          {tab === 'content' && (
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={30}
              style={{ ...field, fontFamily: C.mono, fontSize: 13, lineHeight: 1.7, resize: 'vertical' }} />
          )}
          {tab === 'html' && (
            <>
              <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 12px' }}>Click to select all, then copy into WordPress.</p>
              <textarea readOnly value={htmlBody} rows={30}
                onClick={e => (e.target as HTMLTextAreaElement).select()}
                style={{ ...field, fontFamily: C.mono, fontSize: 12, lineHeight: 1.6, color: C.textSub, background: C.bg, resize: 'vertical', cursor: 'text' }} />
            </>
          )}
        </div>
      </div>

      {/* LinkedIn */}
      {linkedinPost && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={sectionLabel}>LinkedIn post</span>
            <CopyButton getText={() => linkedinPost} />
          </div>
          <textarea value={linkedinPost} onChange={e => setLinkedinPost(e.target.value)} rows={6} style={field} />
        </div>
      )}

      {/* Email teaser */}
      {emailTeaser && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={sectionLabel}>Email teaser</span>
            <CopyButton getText={() => emailTeaser} />
          </div>
          <textarea value={emailTeaser} onChange={e => setEmailTeaser(e.target.value)} rows={3} style={field} />
        </div>
      )}

      {/* CTAs */}
      {draft.cta_suggestions?.length > 0 && (
        <div style={card}>
          <span style={sectionLabel}>Call to action suggestions</span>
          {draft.cta_suggestions.map((cta: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <span style={{ color: C.accent, fontSize: 16, fontWeight: 700 }}>→</span>
              <span style={{ fontSize: 14, color: C.text }}>{cta}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 32 }}>Generated {createdAt} · ThingLink Blog Writer</p>
    </div>
  )
}
