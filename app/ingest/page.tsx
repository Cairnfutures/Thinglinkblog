'use client'

import { useState } from 'react'

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

  async function runIngest() {
    setStatus('running')
    setResult(null)

    try {
      const res = await fetch('/api/ingest', { method: 'POST' })
      const data: IngestResult = await res.json()
      setResult(data)
      setStatus(data.success ? 'done' : 'error')
    } catch (err: any) {
      setResult({ success: false, error: err.message })
      setStatus('error')
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">ThingLink Blog Project</h1>
      <p className="text-gray-500 mb-8">Ingest the ThingLink blog archive</p>

      <div className="border rounded-xl p-6 bg-white shadow-sm">
        <h2 className="font-semibold text-lg mb-2">Blog Archive Ingest</h2>
        <p className="text-sm text-gray-600 mb-4">
          This will scan <strong>thinglink.com/blog</strong>, scrape every post,
          generate embeddings, and store everything in Supabase.
          <br />
          <span className="text-amber-600 font-medium">First run takes 10–20 minutes</span> depending on how many posts exist.
          Subsequent runs only process new posts.
        </p>

        <button
          onClick={runIngest}
          disabled={status === 'running'}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {status === 'running' ? 'Running… (check Terminal for progress)' : 'Start Ingest'}
        </button>
      </div>

      {status === 'running' && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <p className="font-medium">Ingest in progress…</p>
          <p className="mt-1 text-blue-600">
            Open your Terminal to see live progress. This page will update when complete.
          </p>
        </div>
      )}

      {status === 'done' && result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-semibold text-green-800 mb-2">✓ Ingest complete</p>
          <div className="text-sm text-green-700 space-y-1">
            <p>Posts ingested: <strong>{result.ingested}</strong></p>
            <p>Posts skipped (already existed): <strong>{result.skipped}</strong></p>
            <p>Errors: <strong>{result.errors}</strong></p>
          </div>
          {result.errorList && result.errorList.length > 0 && (
            <details className="mt-3">
              <summary className="text-sm text-red-600 cursor-pointer">Show errors</summary>
              <ul className="mt-2 text-xs text-red-500 space-y-1">
                {result.errorList.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {status === 'error' && result && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <p className="font-semibold">Ingest failed</p>
          <p className="mt-1">{result.error}</p>
        </div>
      )}
    </main>
  )
}
