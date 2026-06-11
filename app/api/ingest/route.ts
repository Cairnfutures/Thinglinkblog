import { NextResponse } from 'next/server'
import { discoverPostUrls, scrapePost } from '@/lib/scraper'
import { embed } from '@/lib/openai'
import { supabaseAdmin } from '@/lib/supabase'

// Allow up to 5 minutes for the full ingest run
export const maxDuration = 300

export async function POST() {
  const results = { ingested: 0, skipped: 0, errors: 0, errorList: [] as string[] }

  try {
    // ── 1. Discover all post URLs ──────────
    console.log('Starting post discovery...')
    const urls = await discoverPostUrls()
    console.log(`Found ${urls.length} post URLs`)

    // ── 2. Check which URLs already exist ──
    const { data: existing } = await supabaseAdmin
      .from('posts')
      .select('url')

    const existingUrls = new Set((existing || []).map((r: { url: string }) => r.url))

    // ── 3. Scrape and store each new post ──
    for (const url of urls) {
      const normUrl = url.replace(/\/$/, '')

      if (existingUrls.has(normUrl)) {
        console.log(`Skipping (already exists): ${normUrl}`)
        results.skipped++
        continue
      }

      try {
        console.log(`Scraping: ${normUrl}`)
        const post = await scrapePost(normUrl)

        // Generate embedding from title + body
        const textToEmbed = `${post.title}\n\n${post.body_text}`.slice(0, 8000)
        const embedding = await embed(textToEmbed)

        // Upsert to Supabase
        const { error } = await supabaseAdmin.from('posts').upsert({
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

        results.ingested++
        console.log(`✓ Ingested: ${post.title}`)

        // Polite delay between posts
        await new Promise(r => setTimeout(r, 600))

      } catch (err: any) {
        console.error(`Error on ${normUrl}:`, err.message)
        results.errors++
        results.errorList.push(`${normUrl}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Ingest complete`,
      ...results,
    })

  } catch (err: any) {
    console.error('Ingest failed:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
