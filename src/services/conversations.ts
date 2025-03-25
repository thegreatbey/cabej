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
  getDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import { User } from 'firebase/auth'

// Define message type for conversation history
export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Timestamp | Date | null
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
  role,
  content,
  timestamp: null // Will be replaced with server timestamp
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