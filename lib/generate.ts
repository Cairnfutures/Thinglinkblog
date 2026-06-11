import { anthropic, GENERATION_MODEL, MAX_TOKENS } from '@/lib/anthropic'
import { embed } from '@/lib/openai'
import { supabaseAdmin } from '@/lib/supabase'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export interface GenerateInput {
  topic: string
  audience: string
  keywords: string
  notes?: string
  specificLinks?: string
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
  const { data, error } = await supabaseAdmin.rpc('match_posts', {
    query_embedding: queryEmbedding,
    match_count: topK,
  })
  if (error) throw error
  return data as { id: string; title: string; url: string; body_text: string; headings: any; similarity: number }[]
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
  const { data } = await supabaseAdmin.rpc('match_posts', {
    query_embedding: queryEmbedding,
    match_count: 1,
  })
  if (data && data[0] && data[0].similarity > 0.92) {
    return data[0].title
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
async function findMatchingExample(queryEmbedding: number[]): Promise<MatchedExample | null> {
  const { data, error } = await supabaseAdmin.rpc('match_examples', {
    query_embedding: queryEmbedding,
    match_count: 1,
  })
  if (error || !data || data.length === 0) return null
  const ex = data[0]
  if (!ex.embed_code) return null
  return {
    name: ex.name,
    thinglink_id: ex.thinglink_id,
    embed_code: ex.embed_code,
    project_type: ex.project_type || '',
    industry: ex.industry || '',
    similarity: ex.similarity,
  }
}

// Insert iframe after the second H2 heading in the body draft
function insertEmbedIntoBody(body: string, example: MatchedExample): string {
  const embedBlock = `\n\n> **See it in action:** ${example.name}\n\n${example.embed_code}\n\n`
  // Find the second H2 (## heading)
  let count = 0
  const insertAfter = body.replace(/^(## .+)$/gm, (match) => {
    count++
    if (count === 2) return match + embedBlock
    return match
  })
  // If there weren't 2 H2s, append at the end
  if (count < 2) return body + embedBlock
  return insertAfter
}

// ─────────────────────────────────────────
// Main generation function
// ─────────────────────────────────────────
export async function generateDraft(input: GenerateInput): Promise<GeneratedDraft> {
  const { topic, audience, keywords, notes, specificLinks } = input

  // 1. Embed the query
  const queryText = `${topic} ${keywords} ${audience}`
  const queryEmbedding = await embed(queryText)

  // 2. Retrieve similar posts + check for duplicates + find matching example
  const [similarPosts, duplicateTitle, freshnessCheck, matchedExample, keywordPosts] = await Promise.all([
    retrieveSimilarPosts(queryEmbedding, 12),
    checkForDuplicate(queryEmbedding),
    Promise.resolve(checkFreshness(topic, keywords)),
    findMatchingExample(queryEmbedding),
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
- Body: 800–1200 words, in markdown, with H2 and H3 headings
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
    max_tokens: MAX_TOKENS,
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

  // 8. Insert example embed into body if we have one
  const rawBody = parsed.body_draft || ''
  const bodyWithEmbed = matchedExample ? insertEmbedIntoBody(rawBody, matchedExample) : rawBody

  // 9. Return structured result
  return {
    title: parsed.title || '',
    slug: parsed.slug || '',
    meta_description: parsed.meta_description || '',
    body_draft: bodyWithEmbed,
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
