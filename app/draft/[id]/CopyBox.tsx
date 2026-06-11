'use client'

import { useState } from 'react'

interface Props {
  html: string
  border: string
  bg: string
  surface: string
  textMuted: string
  textSub: string
  mono: string
}

export default function CopyBox({ html, border, bg, surface, textMuted, textSub, mono }: Props) {
  const [copied, setCopied] = useState(false)

  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted, margin: 0 }}>HTML — paste into WordPress</p>
        <button
          onClick={() => { navigator.clipboard.writeText(html); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ fontSize: 11, padding: '4px 12px', border: `1px solid ${border}`, borderRadius: 6, color: textSub, background: bg, cursor: 'pointer' }}
        >
          {copied ? '✓ Copied' : '⎘ Copy HTML'}
        </button>
      </div>
      <textarea
        readOnly
        value={html}
        rows={16}
        onClick={e => (e.target as HTMLTextAreaElement).select()}
        style={{ width: '100%', fontFamily: mono, fontSize: 11, lineHeight: 1.6, color: textSub, background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '10px 12px', resize: 'vertical', boxSizing: 'border-box', cursor: 'text' }}
      />
    </div>
  )
}
