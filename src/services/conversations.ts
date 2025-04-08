import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc,
  doc,
  orderBy,
  serverTimestamp,
  Timestamp,
  FieldValue,
  updateDoc,
  arrayUnion,
  getDoc,
  limit
} from 'firebase/firestore'
import { db } from '../firebase'
import { User } from 'firebase/auth'

// Define message type for conversation history
export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
  feedback?: 'helpful' | 'notHelpful' | null
}

// Define base conversation type without ID
interface BaseConversation {
  input: string
  response: string
  createdAt: Timestamp | FieldValue | null
  userId?: string | null
  userType: 'guest' | 'auth'
  userEmail?: string | null
  history?: Message[]
}

// Define full conversation type with required ID
export interface Conversation extends BaseConversation {
  id: string
}

// Collection reference
const conversationsCollection = collection(db, 'conversations')

// Helper function to create a message with server timestamp
const createMessage = (role: 'user' | 'assistant', content: string): Message => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  role,
  content,
  timestamp: Date.now()
})

/**
 * Save a conversation to Firestore for authenticated users
 * or return the conversation for guest users
 */
export const saveConversation = async (
  input: string, 
  response: string, 
  user: User | null,
  history: Message[] = []
): Promise<Conversation> => {
  // Create new messages for this exchange
  const newMessages: Message[] = [
    createMessage('user', input),
    createMessage('assistant', response)
  ]
  
  // Combine with existing history
  const updatedHistory = [...history, ...newMessages]
  
  const baseConversation: BaseConversation = {
    input,
    response,
    createdAt: serverTimestamp(),
    userId: user?.uid || null,
    userType: user ? 'auth' : 'guest',
    userEmail: user?.email || null,
    history: updatedHistory
  }

  // For authenticated users, save to Firestore
  if (user) {
    try {
      const docRef = await addDoc(conversationsCollection, baseConversation)
      return { ...baseConversation, id: docRef.id }
    } catch (error) {
      console.error('Error saving conversation:', error)
      throw new Error('Failed to save conversation')
    }
  }

  // For guest users, generate a temporary ID
  return { ...baseConversation, id: `guest-${Date.now()}` }
}

/**
 * Update conversation history
 */
export const updateConversationHistory = async (
  conversationId: string,
  input: string,
  response: string
): Promise<void> => {
  try {
    const conversationRef = doc(conversationsCollection, conversationId)
    
    // Add new messages to history
    const newMessages: Message[] = [
      createMessage('user', input),
      createMessage('assistant', response)
    ]
    
    await updateDoc(conversationRef, {
      history: arrayUnion(...newMessages),
      input,
      response
    })
  } catch (error) {
    console.error('Error updating conversation history:', error)
    throw new Error('Failed to update conversation history')
  }
}

/**
 * Get a single conversation by ID
 */
export const getConversation = async (conversationId: string): Promise<Conversation | null> => {
  try {
    const conversationRef = doc(conversationsCollection, conversationId)
    const docSnap = await getDoc(conversationRef)
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Conversation
    }
    
    return null
  } catch (error) {
    console.error('Error getting conversation:', error)
    throw new Error('Failed to get conversation')
  }
}

/**
 * Get all conversations for a user
 */
export const getUserConversations = async (user: User): Promise<Conversation[]> => {
  try {
    const q = query(
      conversationsCollection, 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Conversation))
  } catch (error) {
    console.error('Error getting conversations:', error)
    throw new Error('Failed to get conversations')
  }
}

/**
 * Delete a conversation
 */
export const deleteConversation = async (conversationId: string): Promise<void> => {
  try {
    await deleteDoc(doc(conversationsCollection, conversationId))
  } catch (error) {
    console.error('Error deleting conversation:', error)
    throw new Error('Failed to delete conversation')
  }
}

/**
 * Transfer guest conversations to authenticated user
 */
export const transferGuestConversations = async (
  guestConversations: Conversation[], 
  user: User
): Promise<void> => {
  try {
    // Create a batch of promises to add all conversations
    const promises = guestConversations.map(conversation => {
      const { id, ...conversationData } = conversation
      return addDoc(conversationsCollection, {
        ...conversationData,
        userId: user.uid,
        userType: 'auth',                // Update userType to auth
        userEmail: user.email,           // Add the user's email
        createdAt: serverTimestamp()
      })
    })
    
    await Promise.all(promises)
  } catch (error) {
    console.error('Error transferring conversations:', error)
    throw new Error('Failed to transfer conversations')
  }
}

// Helper function to convert Firestore timestamp to Date
export const convertTimestamp = (timestamp: Timestamp | FieldValue | null): Date | undefined => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  return undefined
}

// Function to get guest conversations from session storage
export function getGuestConversations(): Conversation[] {
  try {
    const storedConversations = sessionStorage.getItem('guestConversations')
    if (storedConversations) {
      return JSON.parse(storedConversations)
    }
  } catch (error) {
    console.error('Error getting guest conversations:', error)
  }
  return []
}

// Add new function to record user feedback on responses
export async function recordResponseFeedback(
  userId: string | null,
  messageId: string,
  feedback: 'helpful' | 'notHelpful' | null
): Promise<boolean> {
  try {
    // For guest users, update session storage
    if (!userId) {
      const guestConversations = getGuestConversations()
      
      // Find all conversations with this message
      let updated = false
      const updatedConversations = guestConversations.map((conv: Conversation) => {
        const updatedMessages = conv.history?.map((msg: Message) => {
          if (msg.id === messageId) {
            updated = true
            return { ...msg, feedback }
          }
          return msg
        }) || []
        
        return {
          ...conv,
          history: updatedMessages
        }
      })
      
      if (updated) {
        sessionStorage.setItem('guestConversations', JSON.stringify(updatedConversations))
        return true
      }
      
      return false
    }
    
    // For authenticated users, update Firestore
    const messageRef = doc(db, 'users', userId, 'messages', messageId)
    await updateDoc(messageRef, { feedback })
    
    return true
  } catch (error) {
    console.error('Error recording feedback:', error)
    return false
  }
}

// Add function to get personalized context based on user's feedback history
export async function getPersonalizedContext(userId: string | null): Promise<string> {
  try {
    // For guest users, analyze session storage
    if (!userId) {
      const guestConversations = getGuestConversations()
      // Collect all messages with positive feedback
      const helpfulMessages = guestConversations.flatMap((conv: Conversation) => 
        conv.history?.filter((msg: Message) => msg.feedback === 'helpful') || []
      )
      
      if (helpfulMessages.length === 0) {
        return ''
      }
      
      // Extract recent helpful message contents
      const recentHelpful = helpfulMessages
        .sort((a: Message, b: Message) => b.timestamp - a.timestamp)
        .slice(0, 3)
        .map((msg: Message) => msg.content)
        .join('\n\n')
      
      return `Based on your previous positive interactions, these topics were helpful to you:\n${recentHelpful}`
    }
    
    // For authenticated users, query Firestore
    const messagesRef = collection(db, 'users', userId, 'messages')
    const helpfulQuery = query(
      messagesRef, 
      where('feedback', '==', 'helpful'),
      orderBy('timestamp', 'desc'),
      limit(5)
    )
    
    const helpfulSnapshot = await getDocs(helpfulQuery)
    if (helpfulSnapshot.empty) {
      return ''
    }
    
    const helpfulMessages = helpfulSnapshot.docs.map(doc => doc.data() as Message)
    const recentHelpful = helpfulMessages
      .map(msg => msg.content)
      .join('\n\n')
    
    return `Based on your previous positive interactions, these topics were helpful to you:\n${recentHelpful}`
  } catch (error) {
    console.error('Error getting personalized context:', error)
    return ''
  }
} 