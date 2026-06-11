import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Embed a single string using text-embedding-3-small
// Returns a 1536-dimension vector
export async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // stay well within token limit
  })
  return response.data[0].embedding
}
