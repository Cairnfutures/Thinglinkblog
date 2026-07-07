/**
 * Ingest ThingLink support articles from the Zendesk API into Supabase.
 *
 * Creates the support_articles table if it doesn't exist (via SQL in README),
 * then fetches all published articles and upserts them.
 *
 * Run: npx tsx scripts/ingest-support.ts
 */

import path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ZENDESK_BASE = 'https://support.thinglink.com/api/v2/help_center/en-us'

/** Strip HTML tags and decode basic entities */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function fetchAllArticles() {
  const articles: any[] = []
  let url: string | null = `${ZENDESK_BASE}/articles.json?per_page=100&sort_by=updated_at&sort_order=desc`

  while (url) {
    const res: Response = await fetch(url)
    if (!res.ok) throw new Error(`Zendesk API error: ${res.status} ${res.statusText}`)
    const json = await res.json()
    articles.push(...json.articles)
    url = json.next_page ?? null
    console.log(`  Fetched ${articles.length} / ${json.count} articles...`)
  }
  return articles
}

async function fetchSections(): Promise<Map<number, string>> {
  const sections = new Map<number, string>()
  let url: string | null = `${ZENDESK_BASE}/sections.json?per_page=100`
  while (url) {
    const res: Response = await fetch(url)
    const json = await res.json()
    for (const s of json.sections || []) sections.set(s.id, s.name)
    url = json.next_page ?? null
  }
  return sections
}

async function main() {
  console.log('── Ingesting ThingLink Support Articles ────\n')

  console.log('Fetching sections...')
  const sections = await fetchSections()
  console.log(`  ${sections.size} sections loaded\n`)

  console.log('Fetching articles...')
  const articles = await fetchAllArticles()
  console.log(`\n${articles.length} articles fetched\n`)

  let upserted = 0, skipped = 0, errors = 0

  for (const article of articles) {
    // Skip draft articles
    if (article.draft) { skipped++; continue }

    const body_text = stripHtml(article.body || '')
    const section = sections.get(article.section_id) ?? ''

    const { error } = await supabase
      .from('support_articles')
      .upsert({
        zendesk_id:   article.id,
        title:        article.title,
        url:          article.html_url,
        body_text,
        section,
        updated_at:   article.updated_at,
      }, { onConflict: 'zendesk_id' })

    if (error) {
      console.error(`  ✗ ${article.title}: ${error.message}`)
      errors++
    } else {
      upserted++
    }
  }

  console.log('──────────────────────────────────────────')
  console.log(`Upserted: ${upserted} | Skipped drafts: ${skipped} | Errors: ${errors}`)
  console.log('──────────────────────────────────────────')
  console.log('\n⚠ Run embed-support.ts next to generate embeddings.')
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
