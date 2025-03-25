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
  const [loadingText, setLoadingText] = useState('Generating')
  const [showClearButton, setShowClearButton] = useState(false)
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
          // Hide clear button since we reset everything
          setShowClearButton(false)
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

  // Loading text animation
  useEffect(() => {
    let intervalId: number | undefined
    
    if (isLoading) {
      intervalId = window.setInterval(() => {
        setLoadingText(prevText => {
          // Set initial text to lowercase when loading starts
          if (prevText === 'generating.') return 'generating..'
          if (prevText === 'generating..') return 'generating...'
          if (prevText === 'generating...') return 'generating.'
          return 'generating.'
        })
      }, 500)
    } else {
      // When loading is done, revert to original text
      setLoadingText('Generate')
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isLoading])
  
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
      
      // Show Clear Everything button after a response is generated
      setShowClearButton(true)
      
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
    
    // Show the Clear Everything button when selecting an existing conversation
    setShowClearButton(true)
  }
  
  const handleStartNewConversation = () => {
    setActiveConversationId(null)
    setConversationHistory([])
    setInputText('')
    
    // Hide the Clear Everything button when starting a new conversation
    setShowClearButton(false)
  }

  const handleClearEverything = () => {
    // Reset all conversation state
    setActiveConversationId(null)
    setConversationHistory([])
    setInputText('')
    
    // Hide the Clear Everything button
    setShowClearButton(false)
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
      
      // Force a re-render
      setLoadingText(prev => prev)
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
    <div className="bg-gray-100 min-h-screen w-full">
      <div className="container mx-auto px-4 py-4 pb-20 lg:pb-4 lg:pt-12
                      pt-[env(safe-area-inset-top)]
                      pb-[env(safe-area-inset-bottom)]
                      pl-[env(safe-area-inset-left)]
                      pr-[env(safe-area-inset-right)]">
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
              className="absolute top-0 right-0 
                         p-4 -mt-2 -mr-2" // Increased touch target
            >
              &times;
            </button>
          </div>
        )}
  
        {/* Main layout with mobile-first approach */}
        <div className="relative min-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] 
                        flex flex-col">
          {/* Mobile Amazon link - shown on small screens */}
          <div className="lg:hidden w-full text-center py-2 px-4 
                         bg-white border-b
                         landscape:hidden"> {/* Hide in landscape */}
            <a 
              href="https://www.amazon.com/Nongenetic-Information-Evolution-Nelson-Cabej/dp/0443221596/"
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View Book on Amazon
            </a>
          </div>

          {/* Main content area with mobile-first layout */}
          <div className="flex-1 flex flex-col lg:flex-row
                         landscape:flex-row landscape:h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
            {/* Book info box - responsive positioning */}
            <div className="hidden lg:block lg:w-64 lg:fixed lg:left-[calc(50%-40rem)] lg:top-[calc(8rem+env(safe-area-inset-top))] lg:pt-4">
              <div className="border border-gray-300 bg-white shadow-sm p-4 rounded-lg">
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
            
            {/* Input area container - adjusted for landscape */}
            <div className={`w-full px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto 
                           landscape:max-w-none landscape:w-1/2
                           ${showConversations ? 'lg:mr-[calc(50%-32rem)]' : ''}`}>
              <div className="flex flex-col lg:flex-row">
                <div className={`w-full ${showConversations ? 'lg:w-2/3 lg:pr-4' : ''}`}>          
                  {/* Header with responsive layout */}
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 lg:mb-8 space-y-2 sm:space-y-0 mt-2 lg:mt-4">
                    <h1 className="text-xl sm:text-2xl font-semibold">
                      Nongenetic Info AI
                    </h1>
                    
                    {user ? (
                      <div className="flex items-center space-x-2">
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
                      <div className="flex items-center space-x-4">
                        <a 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            window.location.href = "mailto:hi@cabej.app";
                          }}
                          className="text-black hover:underline relative group px-2 py-1"
                        >
                          Contact
                          <div className="absolute hidden group-hover:block bg-white border border-gray-200 shadow-md rounded p-2 right-0 mt-1 w-48 text-sm z-10">
                            <div className="text-black font-bold">Get In Touch</div>
                            <div className="text-black">{'>'} Suggestions</div>
                            <div className="text-black">{'>'} Improvements</div>
                            <div className="text-black">{'>'} Questions</div>
                            <div className="text-black">{'>'} Just say hi!</div>
                          </div>
                        </a>
                        <button 
                          onClick={() => setShowAuthModal(true)}
                          className="text-blue-500 hover:text-blue-700 px-2 py-1"
                        >
                          Sign In
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Conversations button and new conversation button - mobile friendly */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex space-x-2">
                      {conversations.length > 0 && (
                        <button
                          onClick={() => setShowConversations(!showConversations)}
                          className="flex items-center space-x-1 text-green-500 hover:text-green-700 px-3 py-2 rounded-md hover:bg-green-50"
                        >
                          <span>{showConversations ? 'Hide' : 'Show'} Conversations</span>
                        </button>
                      )}
                      
                      {activeConversationId && (
                        <button
                          onClick={handleStartNewConversation}
                          className="flex items-center space-x-1 text-blue-500 hover:text-blue-700 px-3 py-2 rounded-md hover:bg-blue-50"
                        >
                          <span>New Chat</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Active conversation indicator */}
                  {activeConversationId && (
                    <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-700">
                        Continuing conversation: 
                        <span className="font-semibold ml-1">
                          {activeConversation?.input.substring(0, 30)}
                          {activeConversation?.input.length && activeConversation.input.length > 30 ? '...' : ''}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Conversation history display */}
                  {conversationHistory.length > 0 && (
                    <div className="mb-4 border border-gray-200 rounded-lg overflow-y-auto max-h-64">
                      {conversationHistory.map((msg, index) => (
                        <div key={index} className={`p-3 ${msg.role === 'user' ? 'bg-gray-100' : 'bg-white'}`}>
                          <p className="text-xs text-gray-500 mb-1">
                            {msg.role === 'user' ? 'You' : 'AI'}
                          </p>
                          <p>{msg.content}</p>
                        </div>
                      ))}
                      {/* Invisible element at the bottom for automatic scrolling */}
                      <div ref={conversationEndRef} />
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="mt-4">
                    {/* Textarea with adjusted height for landscape */}
                    <textarea 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 
                                sm:p-4 mb-4 resize-none focus:outline-none 
                                focus:ring-2 focus:ring-blue-500 
                                focus:border-transparent
                                h-48 sm:h-64
                                landscape:h-32"
                      placeholder={activeConversationId 
                        ? "Continue your conversation..." 
                        : "Drop in your text here and we'll chat about nongenetic info and the biology secrets it may unlock."}
                      disabled={isLoading}
                      style={{ minHeight: '120px' }}
                    />

                    {/* Button container - adjusted for landscape */}
                    <div className="space-y-3 sm:space-y-0 sm:flex sm:space-x-2
                                  landscape:flex landscape:space-x-2 landscape:space-y-0">
                      {!user && !captchaCompleted ? (
                        <div className="w-full sm:flex-1">
                          <Captcha onSuccess={handleCaptchaSuccess} />
                        </div>
                      ) : (
                        <button 
                          type="submit"
                          disabled={!inputText.trim() || isLoading}
                          className={`w-full sm:flex-1 py-3 sm:py-4 px-4 
                                     text-white rounded-lg transition-colors 
                                     focus:outline-none focus:ring-2 
                                     focus:ring-offset-2
                                     landscape:py-3
                                     ${inputText.trim() && !isLoading
                                       ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500' 
                                       : 'bg-gray-400 cursor-not-allowed'}`}
                        >
                          {isLoading ? loadingText : 'Generate'}
                        </button>
                      )}
                      
                      {showClearButton && captchaCompleted && (
                        <button 
                          type="button"
                          onClick={handleClearEverything}
                          className="w-full sm:w-auto sm:px-6 py-3 sm:py-4 text-white bg-gray-700 hover:bg-gray-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700"
                        >
                          Clear Everything
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Conversations panel - mobile slide-out, desktop side panel */}
                {showConversations && (
                  <div className="fixed lg:relative top-0 right-0 
                                 h-full w-full lg:w-1/3 
                                 landscape:w-1/2 landscape:relative
                                 bg-white lg:bg-transparent 
                                 z-40">
                    <div className="h-full lg:h-auto overflow-y-auto bg-white lg:pl-4 lg:border-l border-gray-200 p-4 lg:p-0">
                      {/* Mobile header with enhanced touch targets */}
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

                      {/* Conversation list with mobile-optimized spacing */}
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
                    
                    {/* Mobile overlay background with touch feedback */}
                    <div 
                      className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30 active:bg-opacity-60 transition-opacity"
                      onClick={() => setShowConversations(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer - adjusted for safe area */}
          <Footer className="mt-4 hidden lg:block 
                            pb-[env(safe-area-inset-bottom)]" />
        </div>

        {/* Bottom Navigation - adjusted for safe area */}
        <BottomNavigation
          showConversations={showConversations}
          onToggleConversations={() => setShowConversations(!showConversations)}
          onNewChat={handleStartNewConversation}
          hasConversations={conversations.length > 0}
          isAuthenticated={!!user}
          onAuthClick={() => user ? signOut() : setShowAuthModal(true)}
          className="pb-[env(safe-area-inset-bottom)]"
        />

        {/* Auth Modal */}
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
      </div>
    </div>
  )
}
