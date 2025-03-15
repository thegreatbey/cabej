import OpenAI from 'openai'

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true // Allow usage in browser environment
})

/**
 * Generate an embedding vector for the given text using OpenAI's embedding model
 * 
 * @param text The text to generate an embedding for
 * @returns A vector representation of the text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // If API key is not set, return a mock embedding
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      console.warn('OpenAI API key not set, returning mock embedding')
      // Return a mock embedding of 1536 dimensions (same as OpenAI's ada-002)
      return Array(1536).fill(0).map(() => Math.random() * 2 - 1)
    }
    
    // Generate embedding using OpenAI's API
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    })
    
    // Return the embedding vector
    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error('Failed to generate embedding')
  }
} 