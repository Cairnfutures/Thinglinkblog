import axios from 'axios'
import * as cheerio from 'cheerio'

const BLOG_BASE = 'https://www.thinglink.com/blog'
const THINGLINK_DOMAIN = 'thinglink.com'

// Polite delay between requests — avoids hammering the server
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const httpClient = axios.create({
  headers: {
    'User-Agent': 'ThingLinkBlogProject/1.0 (internal content tool)',
    'Accept': 'text/html',
  },
  timeout: 15000,
})

// All blog category slugs
const CATEGORIES = [
  'ai', 'ar-solution', 'case-studies', 'classvr',
  'e-learning-and-corporate-training', 'further-and-higher-education',
  'general-interest', 'how-to-thinglink', 'ideas-sparked-by-thinglink',
  'immersive-spaces', 'marketing-and-communications', 'museums-and-libraries',
  'pano-to-360', 'teachers-and-schools', 'luminaries', 'thinglink-xr',
  'unity-and-3d', 'webinars', 'whats-new',
]

// Extract all post URLs from a single HTML page
function extractPostUrls(html: string, allUrls: Set<string>): string[] {
  const $ = cheerio.load(html)
  const found: string[] = []
  $('h3 a[href], h2 a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    if (
      href.includes('/blog/') &&
      !href.includes('/blog/category/') &&
      !href.includes('/blog/tag/') &&
      !href.includes('/blog/author/') &&
      !href.includes('/blog/page/')
    ) {
      const clean = href.replace(/\/$/, '')
      if (!allUrls.has(clean)) {
        allUrls.add(clean)
        found.push(clean)
      }
    }
  })
  return found
}

// Extract ALL post URLs from a page (including already-seen ones)
// Returns total count found on page (to detect when a page is empty)
function countPostsOnPage(html: string): number {
  const $ = cheerio.load(html)
  let count = 0
  $('h3 a[href], h2 a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    if (
      href.includes('/blog/') &&
      !href.includes('/blog/category/') &&
      !href.includes('/blog/tag/') &&
      !href.includes('/blog/author/') &&
      !href.includes('/blog/page/')
    ) count++
  })
  return count
}

// Paginate through a base URL (main listing or category page)
// Stops only when a page returns no posts at all (or 404)
async function paginateSection(baseUrl: string, allUrls: Set<string>): Promise<void> {
  let page = 1
  while (true) {
    const url = page === 1 ? baseUrl : `${baseUrl}/page/${page}/`
    try {
      const res = await httpClient.get(url)
      const totalOnPage = countPostsOnPage(res.data)
      const newFound = extractPostUrls(res.data, allUrls)
      console.log(`  ${url} → ${totalOnPage} posts on page, ${newFound.length} new`)
      // Stop if no posts at all on this page (end of pagination)
      if (totalOnPage === 0) break
      page++
      await delay(800)
    } catch (err: any) {
      if (err?.response?.status === 404) break
      console.error(`  Error fetching ${url}:`, err.message)
      break
    }
  }
}

// ─────────────────────────────────────────
// Step 1: Discover all blog post URLs
// Crawls main listing + all category pages
// ─────────────────────────────────────────
export async function discoverPostUrls(): Promise<string[]> {
  const allUrls = new Set<string>()

  // Main blog listing
  console.log('Scanning main blog listing...')
  await paginateSection(BLOG_BASE, allUrls)

  // Each category
  for (const category of CATEGORIES) {
    console.log(`Scanning category: ${category}`)
    await paginateSection(`${BLOG_BASE}/category/${category}`, allUrls)
  }

  console.log(`Total unique post URLs found: ${allUrls.size}`)
  return Array.from(allUrls)
}

// ─────────────────────────────────────────
// Step 2: Scrape a single blog post
// Returns structured data ready for the DB
// ─────────────────────────────────────────
export interface ScrapedPost {
  url: string
  title: string
  slug: string
  published_date: string | null
  author: string | null
  categories: string[]
  tags: string[]
  meta_description: string | null
  h1: string | null
  headings: { level: string; text: string }[]
  body_text: string
  word_count: number
  internal_links: string[]
}

export async function scrapePost(url: string): Promise<ScrapedPost> {
  const res = await httpClient.get(url)
  const $ = cheerio.load(res.data)

  // ── Title ──────────────────────────────
  const title =
    $('h1.entry-title').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.replace(' | ThingLink Blog', '').trim() ||
    ''

  // ── Slug ───────────────────────────────
  const slug = url.split('/blog/')[1]?.replace(/\/$/, '') || ''

  // ── Meta description ───────────────────
  // Yoast SEO puts the real per-post description in og:description
  // The standard meta description on this site is the generic site tagline
  const ogDescription = $('meta[property="og:description"]').attr('content') || null
  const metaDescription = $('meta[name="description"]').attr('content') || null
  // Use og:description if it differs from the generic site description
  const genericDescription = 'The easiest and fastest immersive content creation suite!'
  const meta_description =
    ogDescription && ogDescription !== genericDescription ? ogDescription :
    metaDescription && metaDescription !== genericDescription ? metaDescription :
    null

  // ── Author ─────────────────────────────
  const author =
    $('meta[name="author"]').attr('content') ||
    $('.author-name').first().text().trim() ||
    $('a[rel="author"]').first().text().trim() ||
    null

  // ── Published date ─────────────────────
  const dateText =
    $('time.entry-date').attr('datetime') ||
    $('time').first().attr('datetime') ||
    $('meta[property="article:published_time"]').attr('content') ||
    null
  const published_date = dateText ? dateText.split('T')[0] : null

  // ── Categories ─────────────────────────
  const categories: string[] = []
  $('a[href*="/blog/category/"]').each((_, el) => {
    const text = $(el).text().trim()
    if (text && !categories.includes(text)) categories.push(text)
  })

  // ── Tags ───────────────────────────────
  const tags: string[] = []
  $('a[href*="/blog/tag/"]').each((_, el) => {
    const text = $(el).text().trim()
    if (text && !tags.includes(text)) tags.push(text)
  })

  // ── Main content ───────────────────────
  // WordPress puts post body in .entry-content
  const contentEl =
    $('.entry-content').first() ||
    $('article .post-content').first() ||
    $('article').first()

  // ── Headings ───────────────────────────
  const headings: { level: string; text: string }[] = []
  contentEl.find('h2, h3').each((_, el) => {
    const text = $(el).text().trim()
    if (text) headings.push({ level: el.tagName.toLowerCase(), text })
  })

  // ── H1 ─────────────────────────────────
  const h1 = title || null

  // ── Body text (clean) ──────────────────
  // Remove nav, footer, sidebar, share buttons, CTAs before extracting text
  $('nav, footer, .sidebar, .share-buttons, .wp-block-buttons, script, style').remove()
  const body_text = contentEl.text()
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 50000) // safety cap

  const word_count = body_text.split(/\s+/).filter(Boolean).length

  // ── Internal links ─────────────────────
  const internal_links: string[] = []
  contentEl.find(`a[href*="${THINGLINK_DOMAIN}"]`).each((_, el) => {
    const href = $(el).attr('href')
    if (href && !internal_links.includes(href)) internal_links.push(href)
  })

  return {
    url,
    title,
    slug,
    published_date,
    author,
    categories,
    tags,
    meta_description,
    h1,
    headings,
    body_text,
    word_count,
    internal_links,
  }
}
