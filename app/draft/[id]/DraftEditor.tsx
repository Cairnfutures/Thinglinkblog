'use client'

import { useState, useMemo } from 'react'
import { marked } from 'marked'

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
}

const field: React.CSSProperties = {
  width: '100%', border: `1px solid ${C.border}`, borderRadius: 8,
  padding: '10px 14px', fontSize: 14, color: C.text, background: C.surface,
  outline: 'none', resize: 'none' as const, fontFamily: C.sans,
  boxSizing: 'border-box' as const, lineHeight: 1.6,
}

const card: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 12, padding: '20px 24px', marginBottom: 16,
}

const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
  letterSpacing: '0.07em', color: C.textMuted, display: 'block', marginBottom: 8,
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

interface Props {
  draft: any
  createdAt: string
}

type Tab = 'content' | 'html'

export default function DraftEditor({ draft, createdAt }: Props) {
  const [title, setTitle] = useState(draft.title || '')
  const [slug, setSlug] = useState(draft.slug || '')
  const [metaDescription, setMetaDescription] = useState(draft.meta_description || '')
  const [body, setBody] = useState(draft.body_draft || '')
  const [linkedinPost, setLinkedinPost] = useState(draft.linkedin_post || '')
  const [emailTeaser, setEmailTeaser] = useState(draft.email_teaser || '')
  const [tab, setTab] = useState<Tab>('content')

  const htmlBody = useMemo(() => marked.parse(body) as string, [body])

  const tabs = [
    { id: 'content' as Tab, label: 'Edit content' },
    { id: 'html' as Tab, label: 'HTML for WordPress' },
  ]

  return (
    <div style={{ fontFamily: C.sans }}>

      {/* Title & slug */}
      <div style={{ marginBottom: 20 }}>
        <input value={title} onChange={e => setTitle(e.target.value)}
          style={{ ...field, fontSize: 24, fontWeight: 600, border: 'none', borderBottom: `1px solid ${C.border}`, borderRadius: 0, padding: '0 0 10px', marginBottom: 8 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, fontFamily: C.mono, color: C.textMuted }}>thinglink.com/blog/</span>
          <input value={slug} onChange={e => setSlug(e.target.value)}
            style={{ ...field, fontSize: 12, fontFamily: C.mono, color: C.accent, border: 'none', padding: 0, fontWeight: 500 }} />
        </div>
      </div>

      {/* Meta description */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={label}>Meta description</span>
          <span style={{ fontSize: 12, fontFamily: C.mono, color: metaDescription.length > 160 ? '#c0392b' : '#27ae60' }}>{metaDescription.length}/160</span>
        </div>
        <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={2} style={field} />
      </div>

      {/* Body — tabs */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: -14, paddingBottom: 14 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: '6px 16px', fontSize: 13, fontWeight: tab === t.id ? 500 : 400, color: tab === t.id ? C.accent : C.textSub, background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`, cursor: 'pointer', fontFamily: C.sans, marginBottom: -1 }}>
                {t.label}
              </button>
            ))}
          </div>
          <CopyButton getText={() => tab === 'html' ? htmlBody : body} text={tab === 'html' ? '⎘ Copy HTML' : '⎘ Copy markdown'} />
        </div>

        <div style={{ marginTop: 20 }}>
          {tab === 'content' && (
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={30}
              style={{ ...field, fontFamily: C.mono, fontSize: 13, lineHeight: 1.7, resize: 'vertical' }} />
          )}
          {tab === 'html' && (
            <>
              <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 10px' }}>Click to select all, then copy into WordPress.</p>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={label}>LinkedIn post</span>
            <CopyButton getText={() => linkedinPost} />
          </div>
          <textarea value={linkedinPost} onChange={e => setLinkedinPost(e.target.value)} rows={6} style={field} />
        </div>
      )}

      {/* Email teaser */}
      {emailTeaser && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={label}>Email teaser</span>
            <CopyButton getText={() => emailTeaser} />
          </div>
          <textarea value={emailTeaser} onChange={e => setEmailTeaser(e.target.value)} rows={3} style={field} />
        </div>
      )}

      {/* CTAs */}
      {draft.cta_suggestions?.length > 0 && (
        <div style={card}>
          <span style={label}>Call to action suggestions</span>
          {draft.cta_suggestions.map((cta: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: C.accent }}>→</span>
              <span style={{ fontSize: 14, color: C.text }}>{cta}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 32 }}>Generated {createdAt} · ThingLink Blog Writer</p>
    </div>
  )
}
