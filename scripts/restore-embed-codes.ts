/**
 * Restore embed_code for all examples where it is null but thinglink_id is set.
 * Constructs a standard ThingLink iframe embed from the thinglink_id.
 *
 * Run: npx tsx scripts/restore-embed-codes.ts
 */

import path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function buildEmbedCode(thinglinkId: string): string {
  return `<iframe width="960" height="540" data-original-width="960" data-original-height="540" src="https://www.thinglink.com/card/${thinglinkId}" type="text/html" frameborder="0" allowfullscreen allow="fullscreen; xr-spatial-tracking;"></iframe>`
}

async function main() {
  console.log('── Restoring embed codes ───────────────────\n')

  const { data: rows, error } = await supabase
    .from('examples')
    .select('id, name, thinglink_id')
    .is('embed_code', null)
    .not('thinglink_id', 'is', null)

  if (error) { console.error('Failed to fetch rows:', error.message); process.exit(1) }
  if (!rows || rows.length === 0) { console.log('No rows need restoring.'); return }

  console.log(`${rows.length} rows with missing embed_code\n`)

  let restored = 0, errors = 0

  for (const row of rows) {
    const embed_code = buildEmbedCode(row.thinglink_id)
    const { error: updateErr } = await supabase
      .from('examples')
      .update({ embed_code })
      .eq('id', row.id)

    if (updateErr) {
      console.error(`  ✗ ${row.name}: ${updateErr.message}`)
      errors++
    } else {
      console.log(`  ✓ ${row.name}`)
      restored++
    }
  }

  console.log('\n──────────────────────────────────────────')
  console.log(`✓ Restored: ${restored} | ✗ Errors: ${errors}`)
  console.log('──────────────────────────────────────────')
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
