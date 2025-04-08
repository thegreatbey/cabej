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

/**
 * Expands a query with related biological terms to improve search relevance
 * 
 * @param query The original user query
 * @returns An expanded query with additional related terms
 */
export async function expandQuery(query: string): Promise<string> {
  try {
    // If API key is not set, return the original query
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      console.warn('OpenAI API key not set, unable to expand query')
      return query
    }
    
    // Use OpenAI's completion to generate related biological terms and synonyms
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a biology domain expert assistant. Expand the user query with relevant biological concepts, terms, and synonyms to improve search relevance. Format your response as "Original query + additional terms". Only add truly relevant terms, and limit to 3-5 key additions.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: 100,
      temperature: 0.3
    })
    
    const expandedQuery = completion.choices[0].message.content || query
    console.log('Expanded query:', expandedQuery)
    return expandedQuery
  } catch (error) {
    console.error('Error expanding query:', error)
    return query // Fall back to the original query on error
  }
}

/**
 * Generates multiple embeddings for a query and its expansions, then combines them
 * 
 * @param query The original user query
 * @returns A combined embedding vector with increased relevance
 */
export async function generateEnhancedEmbedding(query: string): Promise<number[]> {
  try {
    // Generate the expanded query
    const expandedQuery = await expandQuery(query)
    
    // Get embeddings for both original and expanded
    const originalEmbedding = await generateEmbedding(query)
    
    // If query wasn't expanded or is the same, just return the original embedding
    if (expandedQuery === query) {
      return originalEmbedding
    }
    
    // Get embedding for expanded query
    const expandedEmbedding = await generateEmbedding(expandedQuery)
    
    // Combine the embeddings with more weight on the original (0.7 to 0.3 ratio)
    const combinedEmbedding = originalEmbedding.map((val, idx) => 
      val * 0.7 + expandedEmbedding[idx] * 0.3
    )
    
    // Normalize the combined embedding
    const magnitude = Math.sqrt(combinedEmbedding.reduce((sum, val) => sum + val * val, 0))
    const normalizedEmbedding = combinedEmbedding.map(val => val / magnitude)
    
    return normalizedEmbedding
  } catch (error) {
    console.error('Error generating enhanced embedding:', error)
    // Fall back to regular embedding on error
    return generateEmbedding(query)
  }
} 