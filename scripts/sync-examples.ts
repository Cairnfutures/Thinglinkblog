/**
 * Sync examples table from new CSV.
 * - Updates metadata for existing rows (preserves embed_code + embedding)
 * - Inserts new rows
 * - Deletes rows removed from CSV
 *
 * Matches by thinglink_id extracted from URL (CSV) or embed_code (DB).
 *
 * STEP 1: Run dry-run to preview changes:
 *   DRY_RUN=true npx tsx scripts/sync-examples.ts
 *
 * STEP 2: Run for real:
 *   npx tsx scripts/sync-examples.ts
 */

import path from 'path'
import fs from 'fs'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.env.DRY_RUN === 'true'

/** Extract the numeric ThingLink ID from any string containing a URL or embed code */
function extractId(s: string): string | null {
  if (!s) return null
  const m = s.match(/(\d{15,})/)   // ThingLink IDs are 18-19 digits
  return m ? m[1] : null
}

async function main() {
  console.log(DRY_RUN ? '── DRY RUN ─────────────────────────────────\n' : '── Syncing ThingLink Examples ─────────────\n')

  // ── STEP 1: Parse CSV ─────────────────────────────────────────────────────────
  const csvPath = path.join(process.cwd(), 'scripts', 'new-examples.csv')
  const raw = fs.readFileSync(csvPath, 'utf-8')
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as any[]
  console.log(`CSV rows: ${rows.length}`)

  // Build map: thinglink_id → csv row
  const csvById = new Map<string, any>()
  let csvSkipped = 0
  for (const row of rows) {
    const url = row['URL'] || row['url'] || ''
    const id = extractId(url)
    if (id) {
      csvById.set(id, row)
    } else {
      csvSkipped++
      console.warn(`  ⚠ No ID in URL for: ${row['Title'] || '(blank)'}`)
    }
  }
  console.log(`CSV rows with valid IDs: ${csvById.size}${csvSkipped ? ` (${csvSkipped} skipped)` : ''}\n`)

  // ── STEP 2: Fetch all existing DB rows ───────────────────────────────────────
  const { data: existing, error } = await supabase
    .from('examples')
    .select('id, name, thinglink_id, embed_code, embedding, vertical, products, media_types, project_type, industry')
  if (error) { console.error('Failed to fetch existing:', error.message); process.exit(1) }
  console.log(`DB rows (original, thinglink_id null): ${existing!.length}`)

  // Build map: thinglink_id (extracted from embed_code) → db row
  const dbById = new Map<string, any>()
  let noEmbedCode = 0
  for (const row of existing!) {
    // Prefer thinglink_id column if set; fall back to extracting from embed_code
    const id = row.thinglink_id
      ? String(row.thinglink_id)
      : extractId(row.embed_code || '')
    if (id) {
      dbById.set(id, row)
    } else {
      noEmbedCode++
    }
  }
  console.log(`DB rows matched by ID: ${dbById.size}${noEmbedCode ? ` (${noEmbedCode} have no embed_code to match)` : ''}\n`)

  // ── STEP 3: Determine updates / inserts / deletes ────────────────────────────
  const toUpdate: any[] = []
  const toInsert: any[] = []
  const dbIds = new Set(dbById.keys())
  const csvIds = new Set(csvById.keys())

  for (const [id, csvRow] of csvById) {
    const meta = {
      name:         csvRow['Title'] || csvRow['Name'] || '',
      vertical:     csvRow['Vertical'] || '',
      products:     csvRow['Products'] || '',
      media_types:  csvRow['Media Types'] || '',
      project_type: csvRow['Project Type'] || '',
      industry:     csvRow['Industry'] || '',
      thinglink_id: id,
    }
    if (dbIds.has(id)) {
      toUpdate.push({ dbId: dbById.get(id)!.id, meta })
    } else {
      toInsert.push(meta)
    }
  }

  // Only delete rows we were able to match by ID (rows with no embed_code can't be reliably deleted)
  const toDelete = [...dbIds].filter(id => !csvIds.has(id))

  console.log('Plan:')
  console.log(`  Update: ${toUpdate.length}`)
  console.log(`  Insert: ${toInsert.length}`)
  console.log(`  Delete: ${toDelete.length}`)
  if (noEmbedCode > 0) console.log(`  Unmatched (no embed_code): ${noEmbedCode} — left untouched`)
  console.log()

  if (DRY_RUN) {
    if (toUpdate.length > 0) {
      console.log('Sample updates (first 5):')
      toUpdate.slice(0, 5).forEach(u => console.log(`  ✎ ${u.meta.name}`))
    }
    if (toInsert.length > 0) {
      console.log('\nNew rows to insert:')
      toInsert.forEach(r => console.log(`  + ${r.name}`))
    }
    if (toDelete.length > 0) {
      console.log('\nRows to delete:')
      toDelete.forEach(id => console.log(`  🗑 ${dbById.get(id)!.name}`))
    }
    console.log('\n(dry run) No changes made.')
    return
  }

  // ── STEP 4: Updates (preserve embed_code + embedding) ────────────────────────
  let updated = 0, inserted = 0, deleted = 0, errors = 0

  for (const { dbId, meta } of toUpdate) {
    const { error } = await supabase.from('examples').update(meta).eq('id', dbId)
    if (error) { console.error(`  ✗ Update ${dbId}: ${error.message}`); errors++ }
    else updated++
  }
  console.log(`✓ Updated ${updated} rows`)

  // ── STEP 5: Inserts ───────────────────────────────────────────────────────────
  if (toInsert.length > 0) {
    const { error } = await supabase.from('examples').insert(toInsert)
    if (error) { console.error(`  ✗ Insert failed: ${error.message}`); errors++ }
    else { inserted = toInsert.length; console.log(`✓ Inserted ${inserted} rows`) }
  }

  // ── STEP 6: Deletes ───────────────────────────────────────────────────────────
  for (const id of toDelete) {
    const dbRow = dbById.get(id)!
    const { error } = await supabase.from('examples').delete().eq('id', dbRow.id)
    if (error) { console.error(`  ✗ Delete ${dbRow.name}: ${error.message}`); errors++ }
    else { deleted++; console.log(`  🗑 Deleted: ${dbRow.name}`) }
  }
  if (deleted > 0) console.log(`✓ Deleted ${deleted} rows`)

  console.log('\n──────────────────────────────────────────')
  console.log(`Updated: ${updated} | Inserted: ${inserted} | Deleted: ${deleted} | Errors: ${errors}`)
  console.log('──────────────────────────────────────────')

  if (inserted > 0) {
    console.log('\n⚠ New rows have no embeddings. Run embed-examples.ts next.')
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
