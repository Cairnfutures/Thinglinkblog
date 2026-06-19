'use client'

import { useState, useMemo, useEffect } from 'react'
import { marked } from '@/lib/marked'

// ── Colour tokens ──────────────────────────────────────────────
const C = {
  bg:        '#f5f5f7',
  surface:   '#ffffff',
  border:    '#e4e4e9',
  text:      '#111118',
  textSub:   '#6b6b80',
  textMuted: '#9999aa',
  accent:    '#6c63ff',
  accentBg:  '#6c63ff14',
  accentBdr: '#6c63ff33',
  topBar:    '#1a1a2e',
  mono:      'ui-monospace, SFMono-Regular, Menlo, monospace',
  sans:      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  grad:      'linear-gradient(135deg,#FFB347 0%,#FF7B8B 35%,#CC80E0 65%,#5CE8D4 100%)',
  gradHover: 'linear-gradient(135deg,#f0a030 0%,#f06070 35%,#b860d0 65%,#40d0c0 100%)',
}

interface SourcePost { id: string; title: string; url: string; similarity: number }

interface Draft {
  title: string; slug: string; meta_description: string; body_draft: string
  headings_plan: { level: string; text: string }[]
  internal_link_suggestions: { url: string; title: string; reason: string }[]
  cta_suggestions: string[]; image_suggestions: string[]
  accessibility_notes: string; linkedin_post: string; email_teaser: string
  freshness_flag: boolean; freshness_reason: string; similarity_warning: string
  source_posts: SourcePost[]
}

type Tab = 'seo' | 'body' | 'social' | 'sources'

function CopyButton({ getText, label = '⎘ Copy' }: { getText: () => string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(getText()); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 12px', border: `1px solid ${C.border}`, borderRadius: 6, color: C.textSub, background: C.bg, cursor: 'pointer', fontFamily: C.sans, fontWeight: 500 }}>
      {copied ? '✓ Copied' : label}
    </button>
  )
}

const field: React.CSSProperties = {
  width: '100%', border: `1px solid ${C.border}`, borderRadius: 8,
  padding: '9px 13px', fontSize: 15, color: C.text,
  background: C.surface, outline: 'none', resize: 'none' as const,
  fontFamily: C.sans, boxSizing: 'border-box' as const, lineHeight: 1.5,
}

const card: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 12, padding: '18px 20px', marginBottom: 14,
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const,
  letterSpacing: '0.08em', color: C.textMuted, display: 'block', marginBottom: 10,
}

export default function GeneratePage() {
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [keywords, setKeywords] = useState('')
  const [notes, setNotes] = useState('')
  const [specificLinks, setSpecificLinks] = useState('')

  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('seo')
  const [bodyMode, setBodyMode] = useState<'preview' | 'markdown' | 'html'>('preview')
  const [htmlOverride, setHtmlOverride] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [headingsPlan, setHeadingsPlan] = useState<{ level: string; text: string }[]>([])
  const [ctaSuggestions, setCtaSuggestions] = useState<string[]>([])
  const [imageSuggestions, setImageSuggestions] = useState<string[]>([])
  const [accessibilityNotes, setAccessibilityNotes] = useState('')
  const [linkedinPost, setLinkedinPost] = useState('')
  const [emailTeaser, setEmailTeaser] = useState('')
  const [internalLinks, setInternalLinks] = useState<Draft['internal_link_suggestions']>([])
  const [sourcePosts, setSourcePosts] = useState<SourcePost[]>([])
  const [freshnessFlag, setFreshnessFlag] = useState(false)
  const [freshnessReason, setFreshnessReason] = useState('')
  const [similarityWarning, setSimilarityWarning] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [postCount, setPostCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/post-count').then(r => r.json()).then(d => setPostCount(d.count))
  }, [])

  const htmlBody = useMemo(() => {
    if (htmlOverride !== null) return htmlOverride
    return marked.parse(bodyDraft) as string
  }, [bodyDraft, htmlOverride])

  const wordCount = useMemo(() => bodyDraft.split(/\s+/).filter(Boolean).length, [bodyDraft])
  const topMatch = sourcePosts[0] ? Math.round(sourcePosts[0].similarity * 100) : null

  function loadDraft(d: Draft) {
    setTitle(d.title); setSlug(d.slug); setMetaDescription(d.meta_description)
    setBodyDraft(d.body_draft); setHeadingsPlan(d.headings_plan)
    setCtaSuggestions(d.cta_suggestions); setImageSuggestions(d.image_suggestions)
    setAccessibilityNotes(d.accessibility_notes); setLinkedinPost(d.linkedin_post)
    setEmailTeaser(d.email_teaser); setInternalLinks(d.internal_link_suggestions)
    setSourcePosts(d.source_posts); setFreshnessFlag(d.freshness_flag)
    setFreshnessReason(d.freshness_reason); setSimilarityWarning(d.similarity_warning)
    setHtmlOverride(null)
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setStatus('generating'); setError(''); setActiveTab('seo')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, audience, keywords, notes, specificLinks, length }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      loadDraft(data.draft)
      setDraftId(data.draftId)
      setStatus('done')
    } catch (err: any) {
      setError(err.message); setStatus('error')
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'seo', label: 'SEO & structure' },
    { id: 'body', label: 'Body draft' },
    { id: 'social', label: 'Social & CTAs' },
    { id: 'sources', label: 'Sources' },
  ]

  const lengthLabels = { short: '400–600 words', medium: '800–1200 words', long: '1500–2000 words' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: C.sans, background: C.bg, margin: 0 }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes gradShift { 0%,100% { background-position: 0% 50% } 50% { background-position: 100% 50% } }
        input:focus, textarea:focus { outline: none; border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${C.accentBg}; }
        .nav-link { opacity: 0.65; transition: opacity 0.15s; }
        .nav-link:hover { opacity: 1; }
        .tab-btn { transition: color 0.15s; }
      `}</style>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56, background: C.topBar, flexShrink: 0, borderBottom: '3px solid transparent', borderImage: C.grad + ' 1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: C.grad, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>✦</div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>ThingLink Blog Writer</span>
            <span style={{ fontSize: 13, color: '#a09af0', fontWeight: 400, marginLeft: 8 }}>/ New draft</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/drafts" className="nav-link" style={{ fontSize: 13, color: '#fff', textDecoration: 'none', fontWeight: 500 }}>Drafts</a>
          <a href="/ingest" className="nav-link" style={{ fontSize: 13, color: '#fff', textDecoration: 'none', fontWeight: 500 }}>Archive</a>
          <div style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'rgba(108,99,255,0.2)', color: '#c0bcff', border: '1px solid rgba(108,99,255,0.35)', fontWeight: 500 }}>{postCount !== null ? `${postCount.toLocaleString()} posts indexed` : 'Loading…'}</div>
        </div>
      </div>

      {/* ── Two-column body ───────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside style={{ width: 300, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, overflowY: 'auto' }}>
          <form onSubmit={handleGenerate} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ paddingBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>New draft</span>
              <p style={{ fontSize: 13, color: C.textMuted, margin: '3px 0 0' }}>Fill in the brief below</p>
            </div>

            <div style={{ height: 1, background: C.border, margin: '0 -20px' }} />

            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: C.textSub, display: 'block', marginBottom: 6 }}>Topic <span style={{ color: C.accent }}>*</span></label>
              <input value={topic} onChange={e => setTopic(e.target.value)} required
                placeholder="e.g. Workplace safety training" style={field} />
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: C.textSub, display: 'block', marginBottom: 6 }}>Target audience <span style={{ color: C.accent }}>*</span></label>
              <input value={audience} onChange={e => setAudience(e.target.value)} required
                placeholder="e.g. L&D managers in manufacturing" style={field} />
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: C.textSub, display: 'block', marginBottom: 6 }}>Primary keywords <span style={{ color: C.accent }}>*</span></label>
              <input value={keywords} onChange={e => setKeywords(e.target.value)} required
                placeholder="e.g. immersive safety training, XR" style={field} />
            </div>

            <div style={{ height: 1, background: C.border, margin: '0 -20px' }} />

            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: C.textSub, display: 'block', marginBottom: 6 }}>Additional notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Mention Stora Enso case study" rows={3} style={field} />
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: C.textSub, display: 'block', marginBottom: 6 }}>Specific links to include</label>
              <textarea value={specificLinks} onChange={e => setSpecificLinks(e.target.value)}
                placeholder={'https://thinglink.com/blog/…\nhttps://thinglink.com/blog/…'} rows={3}
                style={{ ...field, fontFamily: C.mono, fontSize: 12 }} />
              <p style={{ fontSize: 11, color: C.textMuted, margin: '5px 0 0' }}>One URL per line — Claude will prioritise these.</p>
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: C.textSub, display: 'block', marginBottom: 8 }}>Post length</label>
              <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 3 }}>
                {(['short', 'medium', 'long'] as const).map(opt => (
                  <button key={opt} type="button" onClick={() => setLength(opt)}
                    style={{
                      flex: 1, padding: '7px 0', fontSize: 13, fontWeight: length === opt ? 600 : 400,
                      color: length === opt ? '#fff' : C.textMuted,
                      background: length === opt ? C.grad : 'transparent',
                      border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: C.sans,
                      textTransform: 'capitalize' as const, transition: 'all 0.2s',
                    }}>
                    {opt}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: C.textMuted, margin: '6px 0 0' }}>{lengthLabels[length]}</p>
            </div>

            <button type="submit" disabled={status === 'generating'}
              style={{
                width: '100%', padding: '12px 0',
                background: status === 'generating' ? '#c0bcff' : C.grad,
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: status === 'generating' ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: C.sans, letterSpacing: '-0.01em',
                boxShadow: status === 'generating' ? 'none' : '0 4px 16px rgba(108,99,255,0.35)',
              }}>
              {status === 'generating' ? '⟳  Generating…' : '✦  Generate draft'}
            </button>

            {status === 'generating' && <p style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', margin: 0 }}>Takes 30–60 seconds…</p>}
            {status === 'error' && (
              <div style={{ padding: '10px 14px', background: '#fff0f0', border: '1px solid #ffb3b3', borderRadius: 8, fontSize: 13, color: '#c0392b' }}>{error}</div>
            )}
          </form>
        </aside>

        {/* ── Main panel ──────────────────────────────────────── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>

          {status === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <div style={{ width: 56, height: 56, background: C.grad, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', boxShadow: '0 8px 24px rgba(108,99,255,0.3)' }}>✦</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: C.textSub, margin: 0 }}>Ready to generate</p>
              <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>Fill in the brief and click Generate draft</p>
            </div>
          )}

          {status === 'generating' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
              <div style={{ width: 44, height: 44, border: `4px solid ${C.accentBg}`, borderTop: `4px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 14, color: C.textSub, margin: 0, fontWeight: 500 }}>Generating your draft…</p>
            </div>
          )}

          {status === 'done' && (
            <>
              {/* Draft header */}
              <div style={{ padding: '16px 24px 0', background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>

                {/* Share link */}
                {draftId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 14px', background: C.accentBg, border: `1px solid ${C.accentBdr}`, borderRadius: 10 }}>
                    <span style={{ fontSize: 13, color: C.accent, flexShrink: 0, fontWeight: 600 }}>🔗 Share link</span>
                    <span style={{ fontSize: 12, fontFamily: C.mono, color: C.textSub, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeof window !== 'undefined' ? `${window.location.origin}/draft/${draftId}` : `/draft/${draftId}`}
                    </span>
                    <button onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/draft/${draftId}`)
                      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000)
                    }} style={{ fontSize: 12, padding: '4px 12px', border: `1px solid ${C.accentBdr}`, borderRadius: 6, color: C.accent, background: C.surface, cursor: 'pointer', flexShrink: 0, fontFamily: C.sans, fontWeight: 500 }}>
                      {linkCopied ? '✓ Copied' : 'Copy link'}
                    </button>
                  </div>
                )}

                {similarityWarning && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fffbeb', border: '1px solid #f6c90e55', borderRadius: 8, fontSize: 13, color: '#92701a' }}>
                    ⚠ Near-duplicate: <strong>{similarityWarning}</strong>
                  </div>
                )}
                {freshnessFlag && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fffbeb', border: '1px solid #f6c90e55', borderRadius: 8, fontSize: 13, color: '#92701a' }}>
                    ⚠ {freshnessReason}
                  </div>
                )}

                {/* Title */}
                <input value={title} onChange={e => setTitle(e.target.value)}
                  style={{ ...field, fontSize: 20, fontWeight: 700, border: 'none', borderBottom: `1px solid ${C.border}`, borderRadius: 0, padding: '0 0 10px', letterSpacing: '-0.02em' }} />

                {/* Slug */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '8px 0 14px' }}>
                  <span style={{ fontSize: 12, fontFamily: C.mono, color: C.textMuted }}>thinglink.com/blog/</span>
                  <input value={slug} onChange={e => setSlug(e.target.value)}
                    style={{ ...field, fontSize: 12, fontFamily: C.mono, color: C.accent, border: 'none', padding: 0, fontWeight: 600 }} />
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { val: topMatch ? `${topMatch}%` : '—', lbl: 'Top source match', accent: false },
                    { val: `${metaDescription.length}/160`, lbl: 'Meta chars', accent: false, warn: metaDescription.length > 160 },
                    { val: wordCount.toLocaleString(), lbl: 'Word count', accent: true },
                  ].map((s, i) => (
                    <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', borderTop: `3px solid transparent`, borderImage: s.accent ? C.grad + ' 1' : undefined }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: s.warn ? '#c0392b' : C.text, letterSpacing: '-0.02em' }}>{s.val}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: -1 }}>
                  {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="tab-btn"
                      style={{
                        padding: '10px 18px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                        color: activeTab === tab.id ? C.accent : C.textSub,
                        background: 'none', border: 'none',
                        borderBottom: `3px solid ${activeTab === tab.id ? C.accent : 'transparent'}`,
                        cursor: 'pointer', fontFamily: C.sans, letterSpacing: '-0.01em',
                      }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                {activeTab === 'seo' && (
                  <div>
                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={sectionLabel}>Meta description</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, fontFamily: C.mono, color: metaDescription.length > 160 ? '#c0392b' : '#27ae60', fontWeight: 600 }}>{metaDescription.length}/160</span>
                          <CopyButton getText={() => metaDescription} />
                        </div>
                      </div>
                      <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={2} style={field} />
                    </div>

                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={sectionLabel}>Heading structure</span>
                        <CopyButton getText={() => headingsPlan.map(h => `${h.level.toUpperCase()}: ${h.text}`).join('\n')} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {headingsPlan.map((h, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: h.level === 'h3' ? 20 : 0 }}>
                            <span style={{ fontSize: 11, fontFamily: C.mono, color: C.accent, background: C.accentBg, border: `1px solid ${C.accentBdr}`, padding: '2px 7px', borderRadius: 5, minWidth: 32, textAlign: 'center' as const, flexShrink: 0, fontWeight: 700 }}>{h.level.toUpperCase()}</span>
                            <input value={h.text}
                              onChange={e => { const n = [...headingsPlan]; n[i] = { ...n[i], text: e.target.value }; setHeadingsPlan(n) }}
                              style={{ ...field, fontWeight: h.level === 'h2' ? 600 : 400 }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {accessibilityNotes && (
                      <div style={{ ...card, background: '#f0f7ff', border: '1px solid #bcd6f5' }}>
                        <span style={{ ...sectionLabel, color: '#185fa5' }}>Accessibility notes</span>
                        <textarea value={accessibilityNotes} onChange={e => setAccessibilityNotes(e.target.value)} rows={2} style={{ ...field, background: '#f0f7ff' }} />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'body' && (
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 3 }}>
                        {(['preview', 'markdown', 'html'] as const).map(m => (
                          <button key={m} onClick={() => { setBodyMode(m); if (m === 'html') setHtmlOverride(null) }}
                            style={{
                              padding: '5px 14px', fontSize: 12, fontWeight: bodyMode === m ? 600 : 400,
                              color: bodyMode === m ? '#fff' : C.textSub,
                              background: bodyMode === m ? C.grad : 'transparent',
                              border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: C.sans, transition: 'all 0.2s',
                            }}>
                            {m === 'preview' ? 'Preview' : m === 'markdown' ? 'Markdown' : 'HTML'}
                          </button>
                        ))}
                      </div>
                      {bodyMode === 'html' && <CopyButton getText={() => htmlBody} label='⎘ Copy HTML' />}
                      {bodyMode === 'markdown' && <CopyButton getText={() => bodyDraft} label='⎘ Copy markdown' />}
                    </div>
                    {bodyMode === 'preview' && (
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        style={{ fontSize: 15, color: C.text, lineHeight: 1.85, padding: '4px 0', outline: 'none', minHeight: 200 }}
                        dangerouslySetInnerHTML={{ __html: htmlBody }}
                        onInput={e => setHtmlOverride((e.currentTarget as HTMLDivElement).innerHTML)}
                      />
                    )}
                    {bodyMode === 'markdown' && (
                      <textarea value={bodyDraft} onChange={e => setBodyDraft(e.target.value)} rows={30}
                        style={{ ...field, fontFamily: C.mono, fontSize: 13, lineHeight: 1.7, resize: 'vertical' }} />
                    )}
                    {bodyMode === 'html' && (
                      <>
                        <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 12px' }}>HTML output — paste directly into WordPress</p>
                        <textarea value={htmlOverride ?? htmlBody} onChange={e => setHtmlOverride(e.target.value)} rows={30}
                          style={{ ...field, fontFamily: C.mono, fontSize: 12, lineHeight: 1.6, resize: 'vertical' }} />
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'social' && (
                  <div>
                    <div style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={sectionLabel}>LinkedIn post</span>
                        <CopyButton getText={() => linkedinPost} />
                      </div>
                      <textarea value={linkedinPost} onChange={e => setLinkedinPost(e.target.value)} rows={6} style={field} />
                    </div>

                    <div style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={sectionLabel}>Email teaser</span>
                        <CopyButton getText={() => emailTeaser} />
                      </div>
                      <textarea value={emailTeaser} onChange={e => setEmailTeaser(e.target.value)} rows={3} style={field} />
                    </div>

                    <div style={card}>
                      <span style={sectionLabel}>Call to action suggestions</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ctaSuggestions.map((cta, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ color: C.accent, fontSize: 16, flexShrink: 0, fontWeight: 700 }}>→</span>
                            <input value={cta} onChange={e => { const n = [...ctaSuggestions]; n[i] = e.target.value; setCtaSuggestions(n) }} style={field} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={card}>
                      <span style={sectionLabel}>Image suggestions</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {imageSuggestions.map((img, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 15, flexShrink: 0 }}>🖼</span>
                            <input value={img} onChange={e => { const n = [...imageSuggestions]; n[i] = e.target.value; setImageSuggestions(n) }} style={field} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'sources' && (
                  <div>
                    <div style={card}>
                      <span style={sectionLabel}>Internal link suggestions</span>
                      <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 14px' }}>Link to these posts from within your draft</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {internalLinks.map((link, i) => (
                          <div key={i}>
                            <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.accent, textDecoration: 'none', fontWeight: 600 }}>{link.title}</a>
                            <p style={{ fontSize: 12, color: C.textMuted, margin: '3px 0 0' }}>{link.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={card}>
                      <span style={sectionLabel}>Archive posts used</span>
                      <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 14px' }}>These posts informed the tone and content of this draft</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {sourcePosts.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 44, flexShrink: 0, paddingTop: 3 }}>
                              <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                                <div style={{ height: '100%', background: C.grad, width: `${p.similarity * 100}%`, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, fontFamily: C.mono, color: C.textMuted, fontWeight: 600 }}>{Math.round(p.similarity * 100)}%</span>
                            </div>
                            <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.text, textDecoration: 'none', lineHeight: 1.5 }}>{p.title}</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
