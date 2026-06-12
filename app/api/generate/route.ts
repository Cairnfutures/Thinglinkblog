import { NextRequest, NextResponse } from 'next/server'
import { generateDraft } from '@/lib/generate'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { topic, audience, keywords, notes, specificLinks, length } = body

    if (!topic || !audience || !keywords) {
      return NextResponse.json(
        { error: 'topic, audience, and keywords are required' },
        { status: 400 }
      )
    }

    const draft = await generateDraft({ topic, audience, keywords, notes, specificLinks, length })

    // Save to database
    const { data, error } = await supabaseAdmin
      .from('generated_drafts')
      .insert({
        input_topic: topic,
        input_audience: audience,
        input_keywords: keywords,
        input_notes: notes || null,
        source_post_ids: draft.source_posts.map(p => p.id),
        title: draft.title,
        slug: draft.slug,
        meta_description: draft.meta_description,
        body_draft: draft.body_draft,
        headings_plan: draft.headings_plan,
        internal_link_suggestions: draft.internal_link_suggestions,
        cta_suggestions: draft.cta_suggestions,
        image_suggestions: draft.image_suggestions,
        accessibility_notes: draft.accessibility_notes,
        linkedin_post: draft.linkedin_post,
        email_teaser: draft.email_teaser,
        freshness_flag: draft.freshness_flag,
        freshness_reason: draft.freshness_reason,
        similarity_warning: draft.similarity_warning,
        status: 'draft',
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, draftId: data.id, draft })
  } catch (err: any) {
    console.error('Generation failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
