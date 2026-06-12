'use client'

import { useState, useMemo } from 'react'
import { marked } from 'marked'

// ── Colour tokens ──────────────────────────────────────────────
const C = {
  bg:        '#f5f5f7',   // page background
  surface:   '#ffffff',   // cards / sidebar
  border:    '#e4e4e9',   // subtle borders
  borderMid: '#d1d1d8',   // slightly stronger border
  text:      '#111118',   // primary text
  textSub:   '#6b6b80',   // secondary text
  textMuted: '#9999aa',   // muted / labels
  accent:    '#6c63ff',   // purple
  accentBg:  '#6c63ff14',
  accentBdr: '#6c63ff33',
  topBar:    '#1a1a2e',   // dark header
  mono:      'ui-monospace, SFMono-Regular, Menlo, monospace',
  sans:      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

interface SourcePost {
  id: string
  title: string
  url: string
  similarity: number
}

interface Draft {
  title: string
  slug: string
  meta_description: string
  body_draft: string
  headings_plan: { level: string; text: string }[]
  internal_link_suggestions: { url: string; title: string; reason: string }[]
  cta_suggestions: string[]
  image_suggestions: string[]
  accessibility_notes: string
  linkedin_post: string
  email_teaser: string
  freshness_flag: boolean
  freshness_reason: string
  similarity_warning: string
  source_posts: SourcePost[]
}

type Tab = 'seo' | 'body' | 'social' | 'sources'

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(getText()); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', border: `1px solid ${C.border}`, borderRadius: 6, color: C.textSub, background: C.bg, cursor: 'pointer', fontFamily: C.sans }}
    >
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  )
}

function MicButton({ onResult, append = false }: { onResult: (text: string) => void; append?: boolean }) {
  const [listening, setListening] = useState(false)

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice input is not supported in this browser. Please use Chrome or Safari.'); return }
    const recognition = new SR()
    recognition.lang = 'en-GB'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      onResult(transcript)
    }
    recognition.start()
  }

  return (
    <button type="button" onClick={startListening} title="Click to speak"
      style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', border: `1px solid ${listening ? '#e74c3c' : C.border}`, background: listening ? '#fdecea' : C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, transition: 'all 0.2s', boxShadow: listening ? '0 0 0 3px #e74c3c22' : 'none' }}>
      {listening ? '⏹' : '🎤'}
    </button>
  )
}

const field: React.CSSProperties = {
  width: '100%', border: `1px solid ${C.border}`, borderRadius: 6,
  padding: '8px 12px', fontSize: 14, color: C.text,
  background: C.surface, outline: 'none', resize: 'none' as const,
  fontFamily: C.sans, boxSizing: 'border-box' as const,
}

const card: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 10, padding: '16px 18px', marginBottom: 12,
}

const chipLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
  letterSpacing: '0.07em', color: C.textMuted, display: 'block', marginBottom: 8,
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
        body: JSON.stringify({ topic, audience, keywords, notes, specificLinks }),
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
    { id: 'seo',     label: 'SEO & structure' },
    { id: 'body',    label: 'Body draft' },
    { id: 'social',  label: 'Social & CTAs' },
    { id: 'sources', label: 'Sources' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: C.sans, background: C.bg, margin: 0 }}>
      <style>{`* { box-sizing: border-box; } body { margin: 0; } @keyframes spin { to { transform: rotate(360deg); } } input:focus, textarea:focus { outline: none; border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${C.accentBg}; }`}</style>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 52, background: C.topBar, color: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>✦</div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>ThingLink Blog Writer <span style={{ color: '#a09af0', fontWeight: 400 }}>/ New draft</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/ingest" style={{ fontSize: 12, color: '#a0a0b8', textDecoration: 'none' }}>Archive</a>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#6c63ff22', color: '#a09af0', border: '1px solid #6c63ff44' }}>743 posts indexed</span>
        </div>
      </div>

      {/* ── Two-column body ───────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside style={{ width: 272, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, overflowY: 'auto' }}>
          <form onSubmit={handleGenerate} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

            <span style={{ ...chipLabel, marginBottom: -4 }}>Brief</span>

            <div>
              <label style={{ fontSize: 13, color: C.textSub, display: 'block', marginBottom: 5 }}>Topic *</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={topic} onChange={e => setTopic(e.target.value)} required
                  placeholder="e.g. Workplace safety training" style={{ ...field, flex: 1 }} />
                <MicButton onResult={t => setTopic(prev => prev ? prev + ' ' + t : t)} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, color: C.textSub, display: 'block', marginBottom: 5 }}>Target audience *</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={audience} onChange={e => setAudience(e.target.value)} required
                  placeholder="e.g. L&D managers in manufacturing" style={{ ...field, flex: 1 }} />
                <MicButton onResult={t => setAudience(prev => prev ? prev + ' ' + t : t)} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, color: C.textSub, display: 'block', marginBottom: 5 }}>Primary keywords *</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={keywords} onChange={e => setKeywords(e.target.value)} required
                  placeholder="e.g. immersive safety training, XR" style={{ ...field, flex: 1 }} />
                <MicButton onResult={t => setKeywords(prev => prev ? prev + ', ' + t : t)} />
              </div>
            </div>

            <div style={{ height: 1, background: C.border, margin: '0 -16px' }} />

            <div>
              <label style={{ fontSize: 13, color: C.textSub, display: 'block', marginBottom: 5 }}>Additional notes</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Mention Stora Enso case study" rows={3} style={{ ...field, flex: 1 }} />
                <MicButton onResult={t => setNotes(prev => prev ? prev + ' ' + t : t)} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, color: C.textSub, display: 'block', marginBottom: 5 }}>Specific links to include</label>
              <textarea value={specificLinks} onChange={e => setSpecificLinks(e.target.value)}
                placeholder={'https://thinglink.com/blog/…\nhttps://thinglink.com/blog/…'} rows={3}
                style={{ ...field, fontFamily: C.mono, fontSize: 11 }} />
              <p style={{ fontSize: 10, color: C.textMuted, margin: '4px 0 0' }}>One URL per line — Claude will prioritise these.</p>
            </div>

            <button type="submit" disabled={status === 'generating'}
              style={{ width: '100%', padding: '10px 0', background: status === 'generating' ? '#9990e8' : C.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: status === 'generating' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: C.sans }}>
              {status === 'generating' ? '⟳  Generating…' : '✦  Generate draft'}
            </button>

            {status === 'generating' && <p style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', margin: 0 }}>Takes 30–60 seconds…</p>}
            {status === 'error' && (
              <div style={{ padding: '8px 12px', background: '#fff0f0', border: '1px solid #ffb3b3', borderRadius: 6, fontSize: 12, color: '#c0392b' }}>{error}</div>
            )}
          </form>
        </aside>

        {/* ── Main panel ──────────────────────────────────────── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>

          {status === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.textMuted, gap: 10 }}>
              <div style={{ fontSize: 36, color: C.accentBdr }}>✦</div>
              <p style={{ fontSize: 14, fontWeight: 500, color: C.textSub, margin: 0 }}>Ready to generate</p>
              <p style={{ fontSize: 12, margin: 0 }}>Fill in the brief and click Generate draft</p>
            </div>
          )}

          {status === 'generating' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14 }}>
              <div style={{ width: 36, height: 36, border: `3px solid ${C.accentBg}`, borderTop: `3px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13, color: C.textSub, margin: 0 }}>Generating your draft…</p>
            </div>
          )}

          {status === 'done' && (
            <>
              {/* Draft header */}
              <div style={{ padding: '14px 20px 0', background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>

                {/* Share link */}
                {draftId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: C.accentBg, border: `1px solid ${C.accentBdr}`, borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: C.accent, flexShrink: 0 }}>🔗 Share:</span>
                    <span style={{ fontSize: 12, fontFamily: C.mono, color: C.textSub, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeof window !== 'undefined' ? `${window.location.origin}/draft/${draftId}` : `/draft/${draftId}`}
                    </span>
                    <button onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/draft/${draftId}`)
                      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000)
                    }} style={{ fontSize: 11, padding: '3px 10px', border: `1px solid ${C.accentBdr}`, borderRadius: 6, color: C.accent, background: C.surface, cursor: 'pointer', flexShrink: 0, fontFamily: C.sans }}>
                      {linkCopied ? '✓ Copied' : 'Copy link'}
                    </button>
                  </div>
                )}

                {similarityWarning && (
                  <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fffbeb', border: '1px solid #f6c90e55', borderRadius: 6, fontSize: 12, color: '#92701a' }}>
                    ⚠ Near-duplicate: <strong>{similarityWarning}</strong>
                  </div>
                )}
                {freshnessFlag && (
                  <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fffbeb', border: '1px solid #f6c90e55', borderRadius: 6, fontSize: 12, color: '#92701a' }}>
                    ⚠ {freshnessReason}
                  </div>
                )}

                {/* Title */}
                <input value={title} onChange={e => setTitle(e.target.value)}
                  style={{ ...field, fontSize: 17, fontWeight: 600, border: 'none', borderBottom: `1px solid ${C.border}`, borderRadius: 0, padding: '0 0 8px', width: '100%' }} />

                {/* Slug */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '6px 0 12px' }}>
                  <span style={{ fontSize: 11, fontFamily: C.mono, color: C.textMuted }}>thinglink.com/blog/</span>
                  <input value={slug} onChange={e => setSlug(e.target.value)}
                    style={{ ...field, fontSize: 11, fontFamily: C.mono, color: C.accent, border: 'none', padding: 0, fontWeight: 500 }} />
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { val: topMatch ? `${topMatch}%` : '—', lbl: 'Top source match' },
                    { val: `${metaDescription.length}/160`, lbl: 'Meta chars', warn: metaDescription.length > 160 },
                    { val: wordCount.toLocaleString(), lbl: 'Word count' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: s.warn ? '#c0392b' : C.text }}>{s.val}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: -1 }}>
                  {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      style={{ padding: '8px 16px', fontSize: 12, fontWeight: activeTab === tab.id ? 500 : 400, color: activeTab === tab.id ? C.accent : C.textSub, background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? C.accent : 'transparent'}`, cursor: 'pointer', fontFamily: C.sans }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

                {activeTab === 'seo' && (
                  <div>
                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={chipLabel}>Meta description</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontFamily: C.mono, color: metaDescription.length > 160 ? '#c0392b' : '#27ae60' }}>{metaDescription.length}/160</span>
                          <CopyButton getText={() => metaDescription} />
                        </div>
                      </div>
                      <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={2} style={field} />
                    </div>

                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={chipLabel}>Heading structure</span>
                        <CopyButton getText={() => headingsPlan.map(h => `${h.level.toUpperCase()}: ${h.text}`).join('\n')} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {headingsPlan.map((h, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: h.level === 'h3' ? 16 : 0 }}>
                            <span style={{ fontSize: 10, fontFamily: C.mono, color: C.accent, background: C.accentBg, border: `1px solid ${C.accentBdr}`, padding: '2px 6px', borderRadius: 4, minWidth: 30, textAlign: 'center' as const, flexShrink: 0 }}>{h.level.toUpperCase()}</span>
                            <input value={h.text}
                              onChange={e => { const n = [...headingsPlan]; n[i] = { ...n[i], text: e.target.value }; setHeadingsPlan(n) }}
                              style={{ ...field, fontWeight: h.level === 'h2' ? 500 : 400 }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {accessibilityNotes && (
                      <div style={{ ...card, background: '#f0f7ff', border: '1px solid #bcd6f5' }}>
                        <span style={{ ...chipLabel, color: '#185fa5' }}>Accessibility notes</span>
                        <textarea value={accessibilityNotes} onChange={e => setAccessibilityNotes(e.target.value)} rows={2} style={{ ...field, background: '#f0f7ff' }} />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'body' && (
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: 2, gap: 2 }}>
                        {(['preview', 'markdown', 'html'] as const).map(m => (
                          <button key={m} onClick={() => { setBodyMode(m); if (m === 'html') setHtmlOverride(null) }}
                            style={{ padding: '4px 12px', fontSize: 11, fontWeight: bodyMode === m ? 500 : 400, color: bodyMode === m ? C.text : C.textSub, background: bodyMode === m ? C.surface : 'transparent', border: bodyMode === m ? `1px solid ${C.border}` : '1px solid transparent', borderRadius: 4, cursor: 'pointer', fontFamily: C.sans }}>
                            {m === 'preview' ? 'Preview' : m === 'markdown' ? 'Markdown' : 'HTML'}
                          </button>
                        ))}
                      </div>
                      {bodyMode === 'html' && <CopyButton getText={() => htmlBody} />}
                      {bodyMode === 'markdown' && <CopyButton getText={() => bodyDraft} />}
                    </div>
                    {bodyMode === 'preview' && (
                      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.8, padding: '4px 0' }} dangerouslySetInnerHTML={{ __html: htmlBody }} suppressHydrationWarning />
                    )}
                    {bodyMode === 'markdown' && (
                      <textarea
                        value={bodyDraft}
                        onChange={e => setBodyDraft(e.target.value)}
                        rows={30}
                        style={{ ...field, fontFamily: C.mono, fontSize: 11, lineHeight: 1.6, resize: 'vertical' }}
                      />
                    )}
                    {bodyMode === 'html' && (
                      <>
                        <p style={{ fontSize: 11, color: C.textMuted, margin: '0 0 10px' }}>HTML output — paste directly into WordPress</p>
                        <textarea
                          value={htmlOverride ?? htmlBody}
                          onChange={e => setHtmlOverride(e.target.value)}
                          rows={30}
                          style={{ ...field, fontFamily: C.mono, fontSize: 11, lineHeight: 1.6, resize: 'vertical' }}
                        />
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'social' && (
                  <div>
                    <div style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={chipLabel}>LinkedIn post</span>
                        <CopyButton getText={() => linkedinPost} />
                      </div>
                      <textarea value={linkedinPost} onChange={e => setLinkedinPost(e.target.value)} rows={6} style={field} />
                    </div>

                    <div style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={chipLabel}>Email teaser</span>
                        <CopyButton getText={() => emailTeaser} />
                      </div>
                      <textarea value={emailTeaser} onChange={e => setEmailTeaser(e.target.value)} rows={3} style={field} />
                    </div>

                    <div style={card}>
                      <span style={chipLabel}>Call to action suggestions</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {ctaSuggestions.map((cta, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: C.accent, fontSize: 14, flexShrink: 0 }}>→</span>
                            <input value={cta} onChange={e => { const n = [...ctaSuggestions]; n[i] = e.target.value; setCtaSuggestions(n) }} style={field} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={card}>
                      <span style={chipLabel}>Image suggestions</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {imageSuggestions.map((img, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, flexShrink: 0 }}>🖼</span>
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
                      <span style={chipLabel}>Internal link suggestions</span>
                      <p style={{ fontSize: 11, color: C.textMuted, margin: '0 0 12px' }}>Link to these posts from within your draft</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {internalLinks.map((link, i) => (
                          <div key={i}>
                            <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 500 }}>{link.title}</a>
                            <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{link.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={card}>
                      <span style={chipLabel}>Archive posts used</span>
                      <p style={{ fontSize: 11, color: C.textMuted, margin: '0 0 12px' }}>These posts informed the tone and content of this draft</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {sourcePosts.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ width: 40, flexShrink: 0, paddingTop: 2 }}>
                              <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}>
                                <div style={{ height: '100%', background: C.accent, width: `${p.similarity * 100}%`, borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 10, fontFamily: C.mono, color: C.textMuted }}>{Math.round(p.similarity * 100)}%</span>
                            </div>
                            <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.text, textDecoration: 'none', lineHeight: 1.4 }}>{p.title}</a>
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
