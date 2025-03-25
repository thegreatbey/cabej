import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from './contexts/AuthContext'
import AuthModal from './components/AuthModal'
import ConversationList from './components/ConversationList'
import Captcha from './components/Captcha'
import Footer from './components/Footer'
import { useLocalStorage } from './hooks/useLocalStorage'
import { 
  saveConversation, 
  getUserConversations, 
  deleteConversation, 
  transferGuestConversations,
  updateConversationHistory,
  convertTimestamp,
  Conversation,
  Message
} from './services/conversations'
import { generateResponse } from './services/ai'
import BottomNavigation from './components/BottomNavigation'

export default function App() {
  const { user, signOut } = useAuth()
  const [inputText, setInputText] = useState('')
  const [guestConversations, setGuestConversations] = useLocalStorage<Conversation[]>('guest-conversations', [])
  const [authConversations, setAuthConversations] = useState<Conversation[]>([])
  const [showConversations, setShowConversations] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [captchaCompleted, setCaptchaCompleted, syncCaptchaState] = useLocalStorage<boolean>('captcha-completed', false)
  
  // Error handling state
  const [error, setError] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)
  
  // Ref for conversation history scrolling
  const conversationEndRef = useRef<HTMLDivElement>(null)
  
  // Active conversation state
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<Message[]>([])
  
  // Get the appropriate conversations based on auth state
  const conversations = user ? authConversations : guestConversations
  
  // Get the active conversation
  const activeConversation = activeConversationId 
    ? conversations.find(conv => conv.id === activeConversationId) 
    : null

  // Load conversations for authenticated users
  useEffect(() => {
    const loadUserConversations = async () => {
      if (user) {
        try {
          const userConversations = await getUserConversations(user)
          setAuthConversations(userConversations)
        } catch (error) {
          displayError('Unable to load conversations. Please try again later.')
          console.error('Error loading conversations:', error)
        }
      }
    }

    if (user) {
      loadUserConversations()
    }
  }, [user])

  // Handle guest-to-auth transition
  useEffect(() => {
    const handleGuestToAuthTransition = async () => {
      // Only proceed if user just logged in and there are guest conversations
      if (user && guestConversations.length > 0) {
        try {
          await transferGuestConversations(guestConversations, user)
          // Reload conversations after transfer
          const userConversations = await getUserConversations(user)
          setAuthConversations(userConversations)
          // Clear guest conversations after successful transfer
          setGuestConversations([])
          // Reset active conversation
          setActiveConversationId(null)
          setConversationHistory([])
        } catch (error) {
          displayError('Error transferring conversations. Your guest conversations are still available.')
          console.error('Error transferring conversations:', error)
        }
      }
    }

    if (user) {
      handleGuestToAuthTransition()
    }
  }, [user, guestConversations, setGuestConversations])

  // Scroll to bottom of conversation when history changes
  useEffect(() => {
    scrollToBottom()
  }, [conversationHistory])
  
  // Auto-hide error message after 5 seconds
  useEffect(() => {
    let timeoutId: number | undefined
    
    if (showError) {
      timeoutId = window.setTimeout(() => {
        setShowError(false)
      }, 5000)
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [showError])

  // Update conversation history when active conversation changes
  useEffect(() => {
    if (activeConversation && activeConversation.history) {
      setConversationHistory(activeConversation.history)
    } else {
      setConversationHistory([])
    }
  }, [activeConversation])
  
  // Helper function to scroll to the bottom of conversation
  const scrollToBottom = () => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }
  
  // Helper function to display errors
  const displayError = (message: string) => {
    setError(message)
    setShowError(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || isLoading) return
    
    setIsLoading(true)
    // Clear any previous errors
    setShowError(false)
    
    try {
      console.log('Text submitted:', inputText)
      
      // Generate response using Claude AI with conversation history
      const response = await generateResponse(inputText, conversationHistory)
      
      // Create new messages for this exchange
      const newMessages: Message[] = [
        { role: 'user', content: inputText, timestamp: new Date() },
        { role: 'assistant', content: response, timestamp: new Date() }
      ]
      
      // Update conversation history
      const updatedHistory = [...conversationHistory, ...newMessages]
      setConversationHistory(updatedHistory)
      
      if (activeConversationId) {
        // Update existing conversation
        if (user) {
          // For authenticated users, update in Firestore
          await updateConversationHistory(activeConversationId, inputText, response)
          // Reload conversations to get the updated data
          const userConversations = await getUserConversations(user)
          setAuthConversations(userConversations)
        } else {
          // For guest users, update in local storage
          const updatedConversations = guestConversations.map(conv => {
            if (conv.id === activeConversationId) {
              return {
                ...conv,
                input: inputText,
                response,
                history: updatedHistory
              }
            }
            return conv
          })
          setGuestConversations(updatedConversations)
        }
      } else {
        // Save as new conversation
        const savedConversation = await saveConversation(
          inputText, 
          response, 
          user, 
          conversationHistory
        )
        
        // For guest users, add to local storage
        if (!user) {
          setGuestConversations([savedConversation, ...guestConversations])
        } else {
          // For auth users, reload from Firestore to get the server timestamp
          const userConversations = await getUserConversations(user)
          setAuthConversations(userConversations)
        }
        
        // Set this as the active conversation
        setActiveConversationId(savedConversation.id || null)
      }
      
      // Clear input
      setInputText('')
    } catch (error) {
      displayError('Error generating response. Please try again later.')
      console.error('Error processing conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteConversation = async (conversationId?: string) => {
    if (!conversationId) return
    
    try {
      // Reset active conversation if deleting the active one
      if (activeConversationId === conversationId) {
        setActiveConversationId(null)
        setConversationHistory([])
      }
      
      // For authenticated users, delete from Firestore
      if (user) {
        await deleteConversation(conversationId)
        // Reload conversations
        const userConversations = await getUserConversations(user)
        setAuthConversations(userConversations)
      } else {
        // For guest users, just remove from local storage
        setGuestConversations(guestConversations.filter(conv => conv.id !== conversationId))
      }
    } catch (error) {
      displayError('Error deleting conversation. Please try again.')
      console.error('Error deleting conversation:', error)
    }
  }
  
  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId)
    const selectedConversation = conversations.find(conv => conv.id === conversationId)
    
    if (selectedConversation && selectedConversation.history) {
      setConversationHistory(selectedConversation.history)
    } else {
      // If no history exists, create it from the input and response
      const timestamp = selectedConversation?.createdAt ? convertTimestamp(selectedConversation.createdAt) : null
      const newHistory: Message[] = [
        { 
          role: 'user', 
          content: selectedConversation?.input || '', 
          timestamp
        },
        { 
          role: 'assistant', 
          content: selectedConversation?.response || '', 
          timestamp
        }
      ]
      setConversationHistory(newHistory)
    }
  }
  
  // Log the captchaCompleted state when it changes
  useEffect(() => {
    console.log(`CAPTCHA state updated: ${captchaCompleted ? 'COMPLETED' : 'NOT COMPLETED'}`)
  }, [captchaCompleted])

  // Update the captcha success handler to be more direct and reliable
  const handleCaptchaSuccess = () => {
    console.log('CAPTCHA completed successfully, updating state to true')
    try {
      // Set the state directly
      setCaptchaCompleted(true)
      
      // Also set localStorage directly for absolute certainty
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('captcha-completed', 'true')
        console.log('Directly set localStorage captcha-completed=true')
      }
    } catch (error) {
      console.error('Error setting captcha state:', error)
      // Fallback approach
      window.localStorage.setItem('captcha-completed', 'true')
    }
  }

  // Reset CAPTCHA state on app initialization for guest users
  useEffect(() => {
    // If user is not authenticated (guest mode), ensure CAPTCHA appears
    if (!user) {
      console.log('Guest user detected on app initialization - checking CAPTCHA state')
      
      // For development mode or testing, uncomment to forcefully reset CAPTCHA state:
      setCaptchaCompleted(false)
      // Also directly clear localStorage to ensure it's reset
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('captcha-completed', 'false')
        console.log('CAPTCHA state forcefully reset for guest user')
      }
    }
  }, []) // Empty dependency array ensures this runs only once on mount

  return (
    <div className="min-h-screen bg-gray-100 overflow-hidden flex flex-col">
      <div className="max-w-2xl mx-auto px-4 w-full flex-1 flex flex-col">
        <div className="flex-1 flex flex-col">
          {/* Error message - adjusted for notched devices */}
          {showError && error && (
            <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] 
                         left-1/2 transform -translate-x-1/2 
                         bg-red-100 border border-red-400 
                         text-red-700 px-4 py-3 rounded 
                         z-50 shadow-md
                         max-w-[90vw] sm:max-w-md">
              <span className="block sm:inline">{error}</span>
              <button 
                onClick={() => setShowError(false)}
                className="absolute top-0 right-0 p-4 -mt-2 -mr-2"
              >
                &times;
              </button>
            </div>
          )}

          {/* Main layout */}
          <div className="relative flex-1 flex flex-col items-center">
            {/* Desktop header */}
            <div className="w-full max-w-xl mb-12">
              <div className="flex justify-between items-center py-6">
                <h1 className="text-xl sm:text-2xl font-semibold">
                  Nongenetic Info AI
                </h1>
                {user ? (
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600 hidden sm:inline">
                      {user.email}
                    </span>
                    <span className="text-sm text-gray-600 sm:hidden">
                      {user.email?.split('@')[0]}
                    </span>
                    <button 
                      onClick={() => {
                        signOut();
                        setCaptchaCompleted(false);
                        setTimeout(syncCaptchaState, 100);
                        window.localStorage.setItem('captcha-completed', 'false');
                      }}
                      className="text-blue-500 hover:text-blue-700 px-2 py-1"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-6">
                    <button onClick={() => window.open('mailto:contact@cabej.app')} className="text-gray-600 hover:text-gray-800">
                      Contact
                    </button>
                    <button onClick={() => setShowAuthModal(true)} className="text-blue-600 hover:text-blue-800">
                      Sign In
                    </button>
                  </div>
                )}
              </div>

              {/* Book info box - desktop */}
              <div className="hidden lg:block lg:fixed lg:w-64" style={{ left: 'calc(50% - 36rem)' }}>
                <div className="border border-gray-300 bg-white shadow-sm p-6 rounded-lg">
                  <p className="text-center text-gray-700 mb-4">
                    The purpose of this app is to interact with the contents of this book in a conversational manner.
                  </p>
                  <div className="flex justify-center">
                    <a 
                      href="https://www.amazon.com/Nongenetic-Information-Evolution-Nelson-Cabej/dp/0443221596/"
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-block hover:opacity-90 transition-opacity"
                    >
                      <img 
                        src="https://m.media-amazon.com/images/I/51gUZLO2yYL._SX342_SY445_.jpg"
                        alt="Nongenetic Information Book Cover" 
                        className="w-40 h-auto border border-gray-200 shadow-sm"
                        loading="eager"
                      />
                    </a>
                  </div>
                </div>
              </div>

              {/* Main content area */}
              <div className="w-full">
                {/* Input form */}
                <form onSubmit={handleSubmit} className="w-full">
                  <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 
                              sm:p-4 mb-4 resize-none focus:outline-none 
                              focus:ring-2 focus:ring-blue-500 
                              focus:border-transparent
                              h-48 sm:h-64
                              bg-white text-gray-900"
                    placeholder={activeConversationId 
                      ? "Continue your conversation..." 
                      : "Drop in your text here and we'll chat about nongenetic info and the biology secrets it may unlock."}
                    disabled={isLoading}
                  />

                  {/* Button container */}
                  <div className="w-full">
                    {!user && !captchaCompleted ? (
                      <Captcha onSuccess={handleCaptchaSuccess} />
                    ) : (
                      <button 
                        type="submit"
                        disabled={!inputText.trim() || isLoading}
                        className={`w-full py-3 sm:py-4 px-4 
                                   text-white rounded-lg transition-colors 
                                   focus:outline-none focus:ring-2 
                                   focus:ring-offset-2
                                   ${inputText.trim() && !isLoading
                                     ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500' 
                                     : 'bg-gray-400 cursor-not-allowed'}`}
                      >
                        {isLoading ? 'Generating...' : 'Generate'}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Conversations panel - mobile slide-out, desktop side panel */}
            {showConversations && (
              <div className="fixed lg:relative top-0 right-0 
                           h-full w-full lg:w-96
                           landscape:w-1/2 landscape:relative
                           bg-white lg:bg-transparent 
                           z-40">
                <div className="h-full lg:h-auto overflow-y-auto bg-white lg:pl-4 lg:border-l border-gray-200 p-4 lg:p-0">
                  {/* Mobile header */}
                  <div className="flex lg:hidden justify-between items-center mb-4 border-b pb-4">
                    <h2 className="text-lg font-semibold px-2">Conversations</h2>
                    <button
                      onClick={() => setShowConversations(false)}
                      className="w-12 h-12 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Close conversations panel"
                    >
                      <span className="text-2xl">✕</span>
                    </button>
                  </div>
                  
                  {/* Desktop header */}
                  <div className="hidden lg:flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Conversations</h2>
                    {!user && guestConversations.length > 0 && (
                      <button
                        onClick={() => setGuestConversations([])}
                        className="text-red-500 text-sm hover:text-red-700 px-4 py-2 rounded-md hover:bg-red-50"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {/* Conversation list */}
                  <div className="space-y-3 sm:space-y-4">
                    <ConversationList 
                      conversations={conversations}
                      onDelete={handleDeleteConversation}
                      onSelect={(id) => {
                        handleSelectConversation(id);
                        // Close conversation panel on mobile after selection
                        if (window.innerWidth < 1024) {
                          setShowConversations(false);
                        }
                      }}
                      activeConversationId={activeConversationId}
                      onRefresh={async () => {
                        if (user) {
                          try {
                            const userConversations = await getUserConversations(user);
                            setAuthConversations(userConversations);
                          } catch (error) {
                            displayError('Unable to refresh conversations. Please try again later.');
                            console.error('Error refreshing conversations:', error);
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                
                {/* Mobile overlay background */}
                <div 
                  className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30 active:bg-opacity-60 transition-opacity"
                  onClick={() => setShowConversations(false)}
                />
              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>

      {/* Bottom Navigation - adjusted for safe area */}
      <BottomNavigation
        showConversations={showConversations}
        onToggleConversations={() => setShowConversations(!showConversations)}
        hasConversations={conversations.length > 0}
        className="pb-[env(safe-area-inset-bottom)]"
      />

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </div>
  )
}
