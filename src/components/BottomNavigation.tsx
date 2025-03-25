import React from 'react';

interface BottomNavigationProps {
  showConversations: boolean;
  onToggleConversations: () => void;
  onNewChat: () => void;
  hasConversations: boolean;
  isAuthenticated: boolean;
  onAuthClick: () => void;
  className?: string;
}

export default function BottomNavigation({
  showConversations,
  onToggleConversations,
  onNewChat,
  hasConversations,
  isAuthenticated,
  onAuthClick,
  className = ''
}: BottomNavigationProps) {
  return (
    <nav className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 lg:hidden ${className}`}>
      <div className="flex justify-around items-center max-w-md mx-auto">
        <button 
          className="flex flex-col items-center p-3 min-w-[72px] min-h-[72px] rounded-lg
                     active:bg-gray-100 transition-colors focus:outline-none focus:ring-2 
                     focus:ring-blue-500 focus:ring-opacity-50"
          onClick={onNewChat}
          aria-label="New Chat"
        >
          <svg 
            className="w-6 h-6 text-blue-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 4v16m8-8H4" 
            />
          </svg>
          <span className="text-xs mt-1 text-gray-600">New Chat</span>
        </button>

        {hasConversations && (
          <button 
            className={`flex flex-col items-center p-3 min-w-[72px] min-h-[72px] rounded-lg
                       active:bg-gray-100 transition-colors focus:outline-none focus:ring-2 
                       focus:ring-blue-500 focus:ring-opacity-50
                       ${showConversations ? 'text-green-500' : 'text-gray-500'}`}
            onClick={onToggleConversations}
            aria-label="Toggle Conversations"
          >
            <svg 
              className="w-6 h-6" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
              />
            </svg>
            <span className="text-xs mt-1 text-gray-600">
              {showConversations ? 'Hide Chats' : 'Show Chats'}
            </span>
          </button>
        )}

        <button 
          className={`flex flex-col items-center p-3 min-w-[72px] min-h-[72px] rounded-lg
                     active:bg-gray-100 transition-colors focus:outline-none focus:ring-2 
                     focus:ring-blue-500 focus:ring-opacity-50
                     ${isAuthenticated ? 'text-blue-500' : 'text-gray-500'}`}
          onClick={onAuthClick}
          aria-label={isAuthenticated ? 'Account' : 'Sign In'}
        >
          <svg 
            className="w-6 h-6" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
            />
          </svg>
          <span className="text-xs mt-1 text-gray-600">
            {isAuthenticated ? 'Account' : 'Sign In'}
          </span>
        </button>
      </div>
    </nav>
  );
} 