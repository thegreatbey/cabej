import Anthropic from '@anthropic-ai/sdk'
import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from './embeddings'
import { Message } from './conversations'

// Initialize Anthropic client
const client = new Anthropic({
  apiKey: import.meta.env.VITE_CLAUDE_API_KEY || ''
})

// Initialize Pinecone with proper configuration
const pinecone = new Pinecone({
  apiKey: import.meta.env.VITE_PINECONE_API_KEY || '',
  environment: import.meta.env.VITE_PINECONE_ENVIRONMENT || 'gcp-starter'
})

// Get Pinecone index
const index = pinecone.index(import.meta.env.VITE_PINECONE_INDEX || '')

/**
 * Generate a response using Claude AI with context from Pinecone
 * and conversation history
 */
export async function generateResponse(
  prompt: string, 
  conversationHistory: Message[] = []
): Promise<string> {
  try {
    console.log('Generating response for:', prompt)
    
    // If API keys are not set, return mock response
    if (!import.meta.env.VITE_CLAUDE_API_KEY || !import.meta.env.VITE_PINECONE_API_KEY) {
      console.warn('API keys not set, returning mock response')
      await new Promise(resolve => setTimeout(resolve, 1000))
      return `This is a mock AI response to: "${prompt}"`
    }
    
    // Step 1: Generate embedding for the prompt
    const embedding = await generateEmbedding(prompt)
    
    // Step 2: Query Pinecone for relevant context
    const queryResponse = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true
    })
    
    // Step 3: Extract relevant context from query results
    const relevantContext = queryResponse.matches
      .filter(match => match.score !== undefined && match.score > 0.7) // Only use matches with high relevance
      .map(match => match.metadata?.text || '')
      .join('\n\n')
    
    // Step 4: Create system prompt with context
    const systemPrompt = `You are the Nongenetic Information AI assistant. You answer questions based on the school of thought, philosophy, and/or concepts developed by the author in this specifics book about nongenetic information and biology. 
    
Use the following context from the book to inform your answers. If the context doesn't contain relevant information, but you can answer based on previous conversation, do so.
If you can't answer based on neither the context nor conversation history, say "I don't have enough information to answer this question based on the book's content."

Context from the book:
${relevantContext}

Maintain a friendly, helpful tone. Cite specific concepts from the book when possible. 
You should reference previous parts of the conversation when relevant to provide continuity.`
    
    // Format messages for Claude API
    const formattedMessages = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
    
    // Add current prompt if not already in history
    if (formattedMessages.length === 0 || 
        formattedMessages[formattedMessages.length - 1].content !== prompt) {
      formattedMessages.push({
        role: 'user',
        content: prompt
      })
    }
    
    // Step 5: Generate response from Claude
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: systemPrompt,
      messages: formattedMessages
    })
    
    // Return the generated response
    return response.content[0].text
  } catch (error) {
    console.error('Error generating AI response:', error)
    return 'Sorry, there was an error generating a response. Please try again later.'
  }
} 