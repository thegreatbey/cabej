import { Pinecone } from '@pinecone-database/pinecone'

const pinecone = new Pinecone({
  apiKey: import.meta.env.VITE_PINECONE_API_KEY || ''
})

const index = pinecone.index(import.meta.env.VITE_PINECONE_INDEX || '')

export const queryVectorDB = async (vector: number[]) => {
  try {
    const queryResponse = await index.query({
      vector,
      topK: 5,
      includeMetadata: true
    })

    return queryResponse.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata
    }))
  } catch (error) {
    console.error('Error querying vector database:', error)
    throw error
  }
} 