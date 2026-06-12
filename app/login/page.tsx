'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const C = {
  bg:      '#f5f5f7',
  surface: '#ffffff',
  border:  '#e4e4e9',
  text:    '#111118',
  textSub: '#6b6b80',
  accent:  '#6c63ff',
  topBar:  '#1a1a2e',
  sans:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/generate'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push(next)
    } else {
      setError('Incorrect password')
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: C.sans, background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: C.topBar, padding: '0 32px', height: 52, display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', fontWeight: 700 }}>✦</div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>ThingLink Blog Writer</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px 36px', width: 340 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>Sign in</h1>
          <p style={{ fontSize: 13, color: C.textSub, margin: '0 0 24px' }}>Enter the password to continue</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              required
              style={{ width: '100%', border: `1px solid ${error ? '#ffb3b3' : C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 14, color: C.text, background: C.bg, outline: 'none', boxSizing: 'border-box' as const, fontFamily: C.sans }}
            />
            {error && <p style={{ fontSize: 12, color: '#c0392b', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '10px 0', background: loading ? '#9990e8' : C.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: C.sans }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
