import { anthropic, GENERATION_MODEL, MAX_TOKENS } from '@/lib/anthropic'
import { embed } from '@/lib/openai'
import { supabaseAdmin } from '@/lib/supabase'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export type PostLength = 'short' | 'medium' | 'long'

const LENGTH_CONFIG: Record<PostLength, { words: string; maxTokens: number }> = {
  short:  { words: '400–600 words',   maxTokens: 3000 },
  medium: { words: '800–1200 words',  maxTokens: 5000 },
  long:   { words: '1500–2000 words', maxTokens: 8000 },
}

export interface GenerateInput {
  topic: string
  audience: string
  keywords: string
  notes?: string
  specificLinks?: string
  length?: PostLength
}

export interface SourcePost {
  id: string
  title: string
  url: string
  similarity: number
}

export interface MatchedExample {
  name: string
  thinglink_id: string
  embed_code: string
  project_type: string
  industry: string
  similarity: number
}

export interface GeneratedDraft {
  title: string
  slug: string
  meta_description: string
  body_draft: string
  headings_plan: { level: string; text: string }[]
  internal_link_suggestions: { url: string; title: string; reason: string }[]
  cta_suggestions: string[]
  image_suggestions: string[]
  accessibility_notes: string
  linkedin_post: string
  email_teaser: string
  freshness_flag: boolean
  freshness_reason: string
  similarity_warning: string
  source_posts: SourcePost[]
  matched_example: MatchedExample | null
}

// ─────────────────────────────────────────
// Retrieve similar posts via vector search
// ─────────────────────────────────────────
async function retrieveSimilarPosts(queryEmbedding: number[], topK = 8) {
  try {
    const { data, error } = await supabaseAdmin.rpc('match_posts', {
      query_embedding: queryEmbedding,
      match_count: topK,
    })
    if (error) {
      console.warn('match_posts RPC error (continuing without vector search):', error.message)
      return []
    }
    return (data || []) as { id: string; title: string; url: string; body_text: string; headings: any; similarity: number }[]
  } catch (err: any) {
    console.warn('retrieveSimilarPosts failed (continuing without vector search):', err.message)
    return []
  }
}

// ─────────────────────────────────────────
// Keyword search to surface named case studies
// ─────────────────────────────────────────
async function searchPostsByKeywords(keywords: string): Promise<{ id: string; title: string; url: string; similarity: number }[]> {
  // Search post titles for any of the topic keywords
  const terms = keywords.split(/[\s,]+/).filter(t => t.length > 3)
  if (terms.length === 0) return []
  const { data } = await supabaseAdmin
    .from('posts')
    .select('id, title, url')
    .or(terms.map(t => `title.ilike.%${t}%`).join(','))
    .limit(8)
  return (data || []).map(p => ({ ...p, similarity: 0.7 }))
}

// ─────────────────────────────────────────
// Check for near-duplicate posts
// ─────────────────────────────────────────
async function checkForDuplicate(queryEmbedding: number[]): Promise<string> {
  try {
    const { data } = await supabaseAdmin.rpc('match_posts', {
      query_embedding: queryEmbedding,
      match_count: 1,
    })
    if (data && data[0] && data[0].similarity > 0.92) {
      return data[0].title
    }
  } catch {
    // Ignore — duplicate check is best-effort
  }
  return ''
}

// ─────────────────────────────────────────
// Freshness check — topics that may need
// external research beyond the archive
// ─────────────────────────────────────────
function checkFreshness(topic: string, keywords: string): { flag: boolean; reason: string } {
  const freshnessSignals = [
    '2025', '2026', '2027', 'latest', 'new', 'recent', 'update', 'launch',
    'release', 'announce', 'just', 'today', 'this week', 'this month',
    'gpt', 'gemini', 'copilot', 'openai', 'apple vision', 'meta quest 3',
    'legislation', 'regulation', 'law', 'compliance',
  ]
  const combined = (topic + ' ' + keywords).toLowerCase()
  const matched = freshnessSignals.filter(s => combined.includes(s))
  if (matched.length > 0) {
    return {
      flag: true,
      reason: `Topic contains signals that may require fresh research: "${matched.join('", "')}". Verify claims against current sources before publishing.`,
    }
  }
  return { flag: false, reason: '' }
}

// ─────────────────────────────────────────
// Find the best matching ThingLink example
// ─────────────────────────────────────────
const EXAMPLE_MIN_SIMILARITY = 0.5

async function findMatchingExample(queryEmbedding: number[]): Promise<MatchedExample | null> {
  try {
    // Try vector search first
    const { data, error } = await supabaseAdmin.rpc('match_examples', {
      query_embedding: queryEmbedding,
      match_count: 5,
    })

    if (!error && data && data.length > 0) {
      const normalised = data.map((ex: any) => ({
        ...ex,
        embed_code: ex.embed_code ?? ex['embed-code'] ?? null,
      }))
      const withEmbed = normalised.filter((ex: any) => ex.embed_code)
      if (withEmbed.length > 0) {
        const candidates = withEmbed.filter((ex: any) => ex.similarity >= EXAMPLE_MIN_SIMILARITY)
        const pool = candidates.length > 0 ? candidates : withEmbed
        const ex = pool[Math.floor(Math.random() * pool.length)]
        return {
          name: ex.name,
          thinglink_id: ex.thinglink_id,
          embed_code: ex.embed_code,
          project_type: ex.project_type || '',
          industry: ex.industry || '',
          similarity: ex.similarity,
        }
      }
    }

    // Fall back to direct table query (works even without embedding column)
    console.warn('match_examples RPC unavailable, falling back to direct table query')
    const { data: rows } = await supabaseAdmin
      .from('examples')
      .select('*')
      .limit(50)

    if (!rows || rows.length === 0) return null

    const withEmbed = rows
      .map((ex: any) => ({ ...ex, embed_code: ex.embed_code ?? ex['embed-code'] ?? null }))
      .filter((ex: any) => ex.embed_code)

    if (withEmbed.length === 0) return null

    const ex = withEmbed[Math.floor(Math.random() * withEmbed.length)]
    return {
      name: ex.name,
      thinglink_id: ex.thinglink_id ?? '',
      embed_code: ex.embed_code,
      project_type: ex.project_type || '',
      industry: ex.industry || '',
      similarity: 0,
    }
  } catch (err: any) {
    console.warn('findMatchingExample failed:', err.message)
    return null
  }
}

// ─────────────────────────────────────────
// ThingLink CTA block (inserted mid + end)
// ─────────────────────────────────────────
const CTA_BLOCK = `
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<div style="width:100%;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#FFB347 0%,#FF7B8B 35%,#CC80E0 65%,#5CE8D4 100%);padding:40px 48px;box-sizing:border-box;text-align:center;font-family:'Inter',sans-serif;">
  <h3 style="font-size:22px;font-weight:600;color:#ffffff;margin:0 0 10px;line-height:1.3;font-family:inherit;">Book a free consultation</h3>
  <p style="font-size:15px;color:#ffffff;margin:0 0 24px;max-width:480px;display:inline-block;line-height:1.6;font-family:inherit;">Find out how ThingLink can transform learning in your organisation. Speak with a specialist today.</p>
  <br>
  <a href="https://www.thinglink.com/demo" style="display:inline-block;background:#0a2540;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:50px;text-decoration:none;font-family:inherit;">Book a free consultation →</a>
</div>`

function insertCTAsIntoBody(body: string): string {
  // Find the midpoint H2 and insert there, then append at the end
  const h2Matches = [...body.matchAll(/^## .+$/gm)]
  let result = body

  if (h2Matches.length >= 2) {
    // Insert BEFORE the middle H2 — end of the preceding paragraph
    const midIndex = Math.floor(h2Matches.length / 2)
    const midMatch = h2Matches[midIndex]
    const insertPos = midMatch.index!
    result = result.slice(0, insertPos) + CTA_BLOCK + '\n\n' + result.slice(insertPos)
  }

  // Always append at the end
  result = result + '\n\n' + CTA_BLOCK
  return result
}

// Insert iframe after the first paragraph following the second H2 heading
function insertEmbedIntoBody(body: string, example: MatchedExample): string {
  const embedBlock = `\n\nIn action! Explore this example.\n\n${example.embed_code}\n\n`

  const h2Matches = [...body.matchAll(/^## .+$/gm)]
  if (h2Matches.length < 2) return body + embedBlock

  // Find position right after the second H2 line
  const secondH2 = h2Matches[1]
  const afterH2 = secondH2.index! + secondH2[0].length

  // Find the end of the next paragraph (next blank line) after the H2
  const rest = body.slice(afterH2)
  const paraEndOffset = rest.search(/\n\n/)

  if (paraEndOffset === -1) return body + embedBlock

  const insertPos = afterH2 + paraEndOffset
  return body.slice(0, insertPos) + embedBlock + body.slice(insertPos)
}

// ─────────────────────────────────────────
// Main generation function
// ─────────────────────────────────────────
export async function generateDraft(input: GenerateInput): Promise<GeneratedDraft> {
  const { topic, audience, keywords, notes, specificLinks, length = 'medium' } = input
  const { words, maxTokens } = LENGTH_CONFIG[length]

  // 1. Embed the query (gracefully skip if OpenAI key missing)
  const queryText = `${topic} ${keywords} ${audience}`
  let queryEmbedding: number[] = []
  try {
    queryEmbedding = await embed(queryText)
  } catch (err: any) {
    console.warn('Embedding failed (continuing without vector search):', err.message)
  }

  // 2. Retrieve similar posts + check for duplicates + find matching example
  const [similarPosts, duplicateTitle, freshnessCheck, matchedExample, keywordPosts] = await Promise.all([
    queryEmbedding.length ? retrieveSimilarPosts(queryEmbedding, 12) : Promise.resolve([]),
    queryEmbedding.length ? checkForDuplicate(queryEmbedding) : Promise.resolve(''),
    Promise.resolve(checkFreshness(topic, keywords)),
    queryEmbedding.length ? findMatchingExample(queryEmbedding) : Promise.resolve(null),
    searchPostsByKeywords(`${topic} ${keywords}`),
  ])

  // Merge vector results with keyword results, deduplicate by URL
  const seenUrls = new Set(similarPosts.map(p => p.url))
  const mergedPosts = [
    ...similarPosts,
    ...keywordPosts.filter(p => !seenUrls.has(p.url)).map(p => ({ ...p, body_text: '', headings: [] })),
  ]

  // 3. Build context from retrieved posts
  const contextPosts = mergedPosts.slice(0, 8).map(p => {
    const headings = Array.isArray(p.headings)
      ? p.headings.map((h: any) => `${h.level.toUpperCase()}: ${h.text}`).join('\n')
      : ''
    return `---\nTITLE: ${p.title}\nURL: ${p.url}\nHEADINGS:\n${headings}\nCONTENT EXCERPT:\n${p.body_text?.slice(0, 800) || ''}\n---`
  }).join('\n\n')

  // 4. Internal link suggestions from merged posts
  const internalLinkSuggestions = mergedPosts.slice(0, 8).map(p => ({
    url: p.url,
    title: p.title,
    reason: `Thematically related — similarity score ${(p.similarity * 100).toFixed(0)}%`,
  }))

  // 5. Build the generation prompt
  const systemPrompt = `You are a senior content strategist and SEO writer for ThingLink, a platform for creating interactive, immersive learning and communication experiences. ThingLink's products include interactive images, videos, 360° tours, virtual environments, XR experiences, and AI-assisted scenario-based learning.

THINGLINK TONE OF VOICE:
- Confident but approachable — knowledgeable without being academic
- Practical and solution-focused — always connects features to real-world outcomes
- Inclusive and accessible — embraces learners and educators at all levels
- Forward-thinking — excited about immersive technology but grounded in pedagogy
- Uses "you" and "your" frequently to address the reader directly
- Avoids jargon overload — explains technical terms clearly
- Celebrates educator and customer stories — concrete examples over abstract claims
- SEO-aware — keywords appear naturally in headings and opening paragraphs
- Posts typically open with a question, a bold statement, or a relatable challenge
- Paragraphs are short (2–4 sentences). Uses H2 and H3 headings generously.
- Avoid overusing em dashes (—). Use them sparingly — no more than once or twice per post. Prefer commas, full stops, or restructured sentences instead.
- Do NOT use horizontal rules (---) anywhere in the post. Use headings to separate sections instead.
- Includes at least one clear CTA per section pointing to ThingLink features or sign-up
- Never makes unverified claims about ThingLink products — only states what is confirmed in the archive

CONTENT RULES:
- Do not copy or closely paraphrase existing posts
- Do not invent case studies, statistics, or product features not present in the source posts
- Flag if the topic requires current information not in the archive
- LINKS: You may ONLY use URLs that appear in the APPROVED LINKS list provided in the user prompt. Never invent, guess, or construct URLs. If you want to link to something, it must come from the approved list exactly as written.
- CTAs must use only approved URLs from the list — never invent paths like /edu, /signup, /pricing etc.
- Meta descriptions must be under 160 characters with the primary keyword in the first 60
- URL slugs: lowercase, hyphens only, max 6 words, keyword-first

OUTPUT FORMAT: Respond with a single valid JSON object. No markdown, no code fences, just raw JSON with these exact keys:
{
  "title": "string",
  "slug": "string",
  "meta_description": "string",
  "body_draft": "string (full blog post in markdown)",
  "headings_plan": [{"level": "h2"|"h3", "text": "string"}],
  "cta_suggestions": ["string"],
  "image_suggestions": ["string"],
  "accessibility_notes": "string",
  "linkedin_post": "string",
  "email_teaser": "string"
}`

  // Build approved links list — user-supplied links take priority, then merged posts
  const userSuppliedLinks = specificLinks
    ? specificLinks.split('\n').map(l => l.trim()).filter(l => l.startsWith('http')).map(l => `- (user-supplied): ${l}`)
    : []
  const archiveLinks = mergedPosts.map(p => `- ${p.title}: ${p.url}`)
  const approvedLinks = [...userSuppliedLinks, ...archiveLinks].join('\n')

  const userPrompt = `Write a ThingLink blog post on the following brief:

TOPIC: ${topic}
TARGET AUDIENCE: ${audience}
PRIMARY KEYWORDS: ${keywords}
ADDITIONAL NOTES: ${notes || 'None'}

APPROVED LINKS (you may ONLY use these URLs when linking in the body or CTAs — do not invent any other URLs. Links marked "user-supplied" MUST be used in the post):
${approvedLinks}

REFERENCE POSTS FROM THE THINGLINK ARCHIVE (use these to inform tone, structure, and content — do not copy them):
${contextPosts}

Requirements:
- Title: SEO-optimised, keyword-forward, compelling (max 70 characters)
- Meta description: under 160 characters, primary keyword in first 60 characters
- Body: ${words}, in markdown, with H2 and H3 headings
- Where you reference a case study, school, or customer example by name, you MUST have an approved URL for it. If a named example does not appear in the APPROVED LINKS list, do not mention it by name — describe it generically instead (e.g. "one UK secondary school" rather than naming the school)
- Link to case studies using the exact URL from the APPROVED LINKS list — never construct or guess a URL
- Suggest 3–5 CTAs using only approved URLs
- Suggest 3 image/visual ideas
- Suggest any accessibility considerations relevant to the topic
- Write a 150-word LinkedIn post to promote this article
- Write a 3-sentence email teaser (subject line + preview text)`

  // 6. Call Claude
  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

  // 7. Parse JSON response
  let parsed: any
  try {
    // Extract the JSON object directly — handles any code fence wrapping
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object found in response')
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`Failed to parse Claude response as JSON. Raw: ${rawText.slice(0, 200)}`)
  }

  // 8. Strip horizontal rules + leading H1 title, insert example embed and CTAs into body
  const rawBody = (parsed.body_draft || '')
    .replace(/^---+$/gm, '')
    .replace(/<hr\s*\/?>/gi, '')
    .replace(/^#\s+.+\n?/, '')  // remove leading H1 (title stored separately)
  const bodyWithEmbed = matchedExample ? insertEmbedIntoBody(rawBody, matchedExample) : rawBody
  const bodyWithCTAs = insertCTAsIntoBody(bodyWithEmbed)

  // 9. Return structured result
  return {
    title: parsed.title || '',
    slug: parsed.slug || '',
    meta_description: parsed.meta_description || '',
    body_draft: bodyWithCTAs,
    headings_plan: parsed.headings_plan || [],
    internal_link_suggestions: internalLinkSuggestions,
    cta_suggestions: parsed.cta_suggestions || [],
    image_suggestions: parsed.image_suggestions || [],
    accessibility_notes: parsed.accessibility_notes || '',
    linkedin_post: parsed.linkedin_post || '',
    email_teaser: parsed.email_teaser || '',
    freshness_flag: freshnessCheck.flag,
    freshness_reason: freshnessCheck.reason,
    similarity_warning: duplicateTitle,
    source_posts: similarPosts.map(p => ({
      id: p.id,
      title: p.title,
      url: p.url,
      similarity: p.similarity,
    })),
    matched_example: matchedExample,
  }
}
