/**
 * Load ThingLink examples from CSV into Supabase with embeddings.
 * Run with: npx tsx scripts/load-examples.ts
 */

import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'

// Load env vars from .env.local
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
    dimensions: 1536,
  })
  return res.data[0].embedding
}

async function main() {
  // Find the CSV — look in a few places
  const candidates = [
    path.join(process.cwd(), 'thinglink-examples.csv'),
    path.join(process.env.HOME || '', 'Downloads', 'thinglink-examples.csv'),
  ]

  let csvPath = ''
  for (const p of candidates) {
    if (fs.existsSync(p)) { csvPath = p; break }
  }

  if (!csvPath) {
    console.error('Could not find thinglink-examples.csv. Copy it to the project root first.')
    process.exit(1)
  }

  console.log(`Reading CSV from: ${csvPath}`)
  const content = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '')
  const rows: Record<string, string>[] = parse(content, { columns: true, skip_empty_lines: true })

  // Only process rows that have an ID (i.e. are embeddable)
  const embeddable = rows.filter(r => r['ID']?.trim())
  console.log(`Found ${rows.length} total rows, ${embeddable.length} with embed codes\n`)

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const [i, row] of embeddable.entries()) {
    const name = row['Name']?.trim() || ''
    const id = row['ID']?.trim() || ''

    // Check if already exists
    const { data: existing } = await supabase
      .from('examples')
      .select('id')
      .eq('thinglink_id', id)
      .single()

    if (existing) {
      console.log(`[${i + 1}/${embeddable.length}] Skipping (exists): ${name}`)
      skipped++
      continue
    }

    try {
      // Build a rich text description for embedding
      const textToEmbed = [
        `Name: ${name}`,
        `Vertical: ${row['Vertical'] || ''}`,
        `Products: ${row['Products'] || ''}`,
        `Media Types: ${row['Media Types'] || ''}`,
        `Project Type: ${row['Project Type'] || ''}`,
        `Industry: ${row['Industry'] || ''}`,
        `Country: ${row['Country'] || ''}`,
      ].filter(Boolean).join('. ')

      const embedding = await embed(textToEmbed)

      // Generate correct embed code based on product type
      const products = row['Products']?.trim() || ''
      const isScenario = products.toLowerCase().includes('scenario')
      const viewType = isScenario ? 'scenario' : 'scene'
      const embedCode = `<iframe width="960" height="720" src="https://www.thinglink.com/view/${viewType}/${id}" type="text/html" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen scrolling="no"></iframe><script async src="//cdn.thinglink.me/jse/responsive.js"></script>`

      const { error } = await supabase.from('examples').insert({
        name,
        thinglink_id: id,
        url: row['URL']?.trim() || null,
        embed_code: embedCode,
        vertical: row['Vertical']?.trim() || null,
        products: row['Products']?.trim() || null,
        media_types: row['Media Types']?.trim() || null,
        project_type: row['Project Type']?.trim() || null,
        industry: row['Industry']?.trim() || null,
        country: row['Country']?.trim() || null,
        embedding,
      })

      if (error) throw error

      console.log(`[${i + 1}/${embeddable.length}] ✓ ${name}`)
      inserted++

      // Polite delay to avoid rate limits
      await delay(300)
    } catch (err: any) {
      console.error(`[${i + 1}/${embeddable.length}] ✗ ${name}: ${err.message}`)
      errors++
    }
  }

  console.log(`\n──────────────────────`)
  console.log(`✓ Inserted: ${inserted}`)
  console.log(`⟳ Skipped:  ${skipped}`)
  console.log(`✗ Errors:   ${errors}`)
  console.log(`──────────────────────`)
}

main()
