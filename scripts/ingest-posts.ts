/**
 * Scrape the ThingLink blog archive and store posts in Supabase with embeddings.
 * Run with: npx tsx scripts/ingest-posts.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 */

import path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { discoverPostUrls, scrapePost } from '../lib/scraper'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return res.data[0].embedding
}

async function main() {
  console.log('── ThingLink Blog Ingest ──────────────────')

  // 1. Discover all post URLs
  console.log('\n1. Discovering post URLs...')
  const urls = await discoverPostUrls()
  console.log(`Found ${urls.length} unique post URLs\n`)

  // 2. Check which already exist
  const { data: existing } = await supabase.from('posts').select('url')
  const existingUrls = new Set((existing || []).map((r: { url: string }) => r.url))
  console.log(`${existingUrls.size} posts already in database\n`)

  // 3. Scrape and store each new post
  const results = { ingested: 0, skipped: 0, errors: 0 }

  for (const [i, url] of urls.entries()) {
    const normUrl = url.replace(/\/$/, '')
    const prefix = `[${i + 1}/${urls.length}]`

    if (existingUrls.has(normUrl)) {
      console.log(`${prefix} skip  ${normUrl}`)
      results.skipped++
      continue
    }

    try {
      const post = await scrapePost(normUrl)
      const textToEmbed = `${post.title}\n\n${post.body_text}`.slice(0, 8000)
      const embedding = await embed(textToEmbed)

      const { error } = await supabase.from('posts').upsert({
        url: normUrl,
        title: post.title,
        slug: post.slug,
        published_date: post.published_date,
        author: post.author,
        categories: post.categories,
        tags: post.tags,
        meta_description: post.meta_description,
        h1: post.h1,
        headings: post.headings,
        body_text: post.body_text,
        word_count: post.word_count,
        internal_links: post.internal_links,
        embedding,
      }, { onConflict: 'url' })

      if (error) throw error

      console.log(`${prefix} ✓  ${post.title}`)
      results.ingested++

      await delay(600)
    } catch (err: any) {
      console.error(`${prefix} ✗  ${normUrl}: ${err.message}`)
      results.errors++
    }
  }

  console.log('\n──────────────────────────────────────────')
  console.log(`✓ Ingested: ${results.ingested}`)
  console.log(`⟳ Skipped:  ${results.skipped}`)
  console.log(`✗ Errors:   ${results.errors}`)
  console.log('──────────────────────────────────────────')
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
