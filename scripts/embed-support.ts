/**
 * Generate embeddings for support articles that don't have one yet.
 * Run: npx tsx scripts/embed-support.ts
 */

import path from 'path'
import * as dotenv from 'dotenv'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return res.data[0].embedding
}

async function main() {
  console.log('── Embedding Support Articles ──────────────\n')

  const { data: articles, error } = await supabase
    .from('support_articles')
    .select('id, title, section, body_text, embedding')
    .is('embedding', null)

  if (error) { console.error('Failed to fetch articles:', error.message); process.exit(1) }

  const toEmbed = (articles || []).filter(a => !a.embedding)
  console.log(`${toEmbed.length} articles need embeddings\n`)

  if (toEmbed.length === 0) {
    console.log('All articles already have embeddings.')
    return
  }

  let embedded = 0, errors = 0

  for (let i = 0; i < toEmbed.length; i++) {
    const article = toEmbed[i]
    const textToEmbed = `${article.title}\n${article.section}\n${article.body_text?.slice(0, 1500) || ''}`

    try {
      const embedding = await embed(textToEmbed)
      const { error: updateErr } = await supabase
        .from('support_articles')
        .update({ embedding })
        .eq('id', article.id)

      if (updateErr) {
        console.error(`  ✗ [${i + 1}/${toEmbed.length}] ${article.title}: ${updateErr.message}`)
        errors++
      } else {
        console.log(`  [${i + 1}/${toEmbed.length}] ✓  ${article.title}`)
        embedded++
      }
    } catch (err: any) {
      console.error(`  ✗ [${i + 1}/${toEmbed.length}] ${article.title}: ${err.message}`)
      errors++
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200))
  }

  console.log('\n──────────────────────────────────────────')
  console.log(`✓ Embedded: ${embedded} | ✗ Errors: ${errors}`)
  console.log('──────────────────────────────────────────')
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
