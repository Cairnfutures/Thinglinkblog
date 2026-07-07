'use client'

import { useState, useEffect } from 'react'

const C = {
  bg:      '#f5f5f7',
  surface: '#ffffff',
  border:  '#e4e4e9',
  text:    '#111118',
  textSub: '#6b6b80',
  muted:   '#9999aa',
  accent:  '#6c63ff',
  topBar:  '#1a1a2e',
  grad:    'linear-gradient(135deg,#FFB347 0%,#FF7B8B 35%,#CC80E0 65%,#5CE8D4 100%)',
  green:   '#22c55e',
  teal:    '#5CE8D4',
}

type IngestResult = {
  success: boolean
  message?: string
  ingested?: number
  skipped?: number
  errors?: number
  errorList?: string[]
  error?: string
}

export default function IngestPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<IngestResult | null>(null)
  const [postCount, setPostCount] = useState<number | null>(null)
  const [supportCount, setSupportCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/post-count').then(r => r.json()).then(d => setPostCount(d.count)).catch(() => {})
    fetch('/api/support-count').then(r => r.json()).then(d => setSupportCount(d.count)).catch(() => {})
  }, [])

  async function runIngest() {
    setStatus('running')
    setResult(null)
    try {
      const res = await fetch('/api/ingest', { method: 'POST' })
      const data: IngestResult = await res.json()
      setResult(data)
      setStatus(data.success ? 'done' : 'error')
      // Refresh post count after ingest
      fetch('/api/post-count').then(r => r.json()).then(d => setPostCount(d.count)).catch(() => {})
    } catch (err: any) {
      setResult({ success: false, error: err.message })
      setStatus('error')
    }
  }

  const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  return (
    <div style={{ fontFamily: sans, background: C.bg, minHeight: '100vh' }}>
      <style>{`.nav-link { opacity: 0.65; transition: opacity 0.15s; } .nav-link:hover { opacity: 1; }`}</style>

      {/* Top bar */}
      <div style={{ background: C.topBar, padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, borderBottom: '3px solid transparent', borderImage: C.grad + ' 1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: C.grad, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', fontWeight: 700 }}>✦</div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>ThingLink Blog Writer</span>
            <span style={{ fontSize: 13, color: '#a09af0', fontWeight: 400, marginLeft: 8 }}>/ Archive</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/generate" className="nav-link" style={{ fontSize: 13, color: '#fff', textDecoration: 'none', fontWeight: 500 }}>+ New draft</a>
          <a href="/drafts" className="nav-link" style={{ fontSize: 13, color: '#fff', textDecoration: 'none', fontWeight: 500 }}>Drafts</a>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Knowledge Archive</h1>
        <p style={{ fontSize: 14, color: C.textSub, margin: '0 0 28px' }}>Content ingested from ThingLink's blog and support centre — used to inform AI blog generation.</p>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.accent, margin: '0 0 8px' }}>Blog Archive</p>
            <p style={{ fontSize: 36, fontWeight: 800, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              {postCount === null ? '—' : postCount.toLocaleString()}
            </p>
            <p style={{ fontSize: 13, color: C.textSub, margin: 0 }}>posts indexed from thinglink.com/blog</p>
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5CE8D4', margin: '0 0 8px' }}>Support Articles</p>
            <p style={{ fontSize: 36, fontWeight: 800, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              {supportCount === null ? '—' : supportCount.toLocaleString()}
            </p>
            <p style={{ fontSize: 13, color: C.textSub, margin: 0 }}>articles from support.thinglink.com</p>
          </div>
        </div>

        {/* Blog ingest */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '24px 28px', marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textSub, margin: '0 0 6px' }}>Blog Archive</p>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>Re-ingest ThingLink Blog</h2>
          <p style={{ fontSize: 13, color: C.textSub, margin: '0 0 16px', lineHeight: 1.6 }}>
            Scans <strong>thinglink.com/blog</strong>, scrapes every post, generates embeddings, and stores in Supabase.
            First run takes 10–20 minutes. Subsequent runs only process new posts.
          </p>
          <button
            onClick={runIngest}
            disabled={status === 'running'}
            style={{ padding: '9px 18px', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: status === 'running' ? 'not-allowed' : 'pointer', opacity: status === 'running' ? 0.5 : 1 }}
          >
            {status === 'running' ? 'Running…' : 'Start Blog Ingest'}
          </button>

          {status === 'running' && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1d4ed8' }}>
              Ingest in progress — open Terminal to see live progress.
            </div>
          )}

          {status === 'done' && result && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13 }}>
              <p style={{ fontWeight: 600, color: '#15803d', margin: '0 0 6px' }}>✓ Ingest complete</p>
              <p style={{ color: '#166534', margin: 0 }}>Ingested: <strong>{result.ingested}</strong> · Skipped: <strong>{result.skipped}</strong> · Errors: <strong>{result.errors}</strong></p>
            </div>
          )}

          {status === 'error' && result && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>
              <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Ingest failed</p>
              <p style={{ margin: 0 }}>{result.error}</p>
            </div>
          )}
        </div>

        {/* Support articles info */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '24px 28px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textSub, margin: '0 0 6px' }}>Support Articles</p>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>Re-ingest Support Centre</h2>
          <p style={{ fontSize: 13, color: C.textSub, margin: '0 0 16px', lineHeight: 1.6 }}>
            Fetches all published articles from <strong>support.thinglink.com</strong> via the Zendesk API
            and stores them in Supabase. Run from your terminal — then run the embed script to generate embeddings.
          </p>
          <div style={{ background: '#f5f5f7', borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: C.textSub, lineHeight: 1.8 }}>
            <div>npx tsx scripts/ingest-support.ts</div>
            <div>npx tsx scripts/embed-support.ts</div>
          </div>
        </div>

      </div>
    </div>
  )
}
