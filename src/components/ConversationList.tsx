import React, { useState, useRef, useCallback } from 'react'
import { Conversation } from '../services/conversations'
import { Timestamp } from 'firebase/firestore'
import { useSwipe } from '../hooks/useSwipe'

interface ConversationListProps {
  conversations: Conversation[]
  onDelete: (id: string) => void
  onSelect: (id: string) => void
  activeConversationId: string | null
  onRefresh?: () => Promise<void>
}

export default function ConversationList({ 
  conversations, 
  onDelete,
  onSelect,
  activeConversationId,
  onRefresh
}: ConversationListProps) {
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Constants for pull-to-refresh
  const PULL_THRESHOLD = 80;
  const MAX_PULL_DISTANCE = 120;
  
  // Handle pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  };
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullStartY.current) return;
    
    const pullDistance = e.touches[0].clientY - pullStartY.current;
    if (pullDistance > 0 && containerRef.current) {
      e.preventDefault();
      const resistance = Math.min(1, pullDistance / MAX_PULL_DISTANCE);
      containerRef.current.style.transform = `translateY(${pullDistance * resistance}px)`;
    }
  }, []);
  
  const handleTouchEnd = useCallback(async (e: React.TouchEvent) => {
    if (!pullStartY.current || !containerRef.current) return;
    
    const pullDistance = e.changedTouches[0].clientY - pullStartY.current;
    
    if (pullDistance > PULL_THRESHOLD && onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    
    containerRef.current.style.transform = 'translateY(0)';
    containerRef.current.style.transition = 'transform 0.3s ease-out';
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.transition = '';
      }
    }, 300);
    
    pullStartY.current = null;
  }, [onRefresh]);

  if (conversations.length === 0) {
    return <p className="text-gray-500">No conversations yet</p>
  }

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: any) => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleString()
    }
    return 'Just now'
  }

  return (
    <div 
      ref={containerRef}
      className="space-y-4 transition-transform"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div className="text-center py-4 text-gray-500">
          Refreshing...
        </div>
      )}
      
      {conversations.map((conv, index) => {
        // Setup swipe handlers for each conversation
        const { isSwiping } = useSwipe({
          onSwipeLeft: () => {
            if (conv.id) onDelete(conv.id);
          },
          onSwipeRight: () => {
            if (conv.id) onSelect(conv.id);
          }
        });
        
        return (
          <div 
            key={conv.id || index} 
            className={`p-4 sm:p-5 border rounded-lg relative transition-all ${
              isSwiping ? 'scale-[0.98]' : ''
            } ${
              conv.id === activeConversationId 
                ? 'border-blue-500 bg-blue-50' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => conv.id && onSelect(conv.id)}
          >
            <button 
              onClick={(e) => {
                e.stopPropagation()
                onDelete(conv.id)
              }}
              className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center text-red-500 hover:text-red-700 rounded-full hover:bg-red-50 transition-colors"
              aria-label="Delete conversation"
            >
              <span className="text-xl">✕</span>
            </button>
            
            <div className="mb-4 pr-10">
              <p className="font-medium text-gray-700 mb-2">You:</p>
              <p className="text-gray-800 text-sm sm:text-base line-clamp-2 leading-relaxed">
                {conv.input}
              </p>
            </div>
            
            <div className="mb-2">
              <p className="font-medium text-gray-700 mb-2">AI:</p>
              <p className="text-gray-800 text-sm sm:text-base line-clamp-3 leading-relaxed">
                {conv.response}
              </p>
            </div>
            
            {conv.createdAt && (
              <p className="text-xs sm:text-sm text-gray-500 mt-3">
                {formatTimestamp(conv.createdAt)}
              </p>
            )}

            {/* Swipe indicators */}
            <div className="absolute inset-y-0 left-0 w-1 bg-green-500 opacity-0 transition-opacity" 
                 style={{ opacity: isSwiping ? 0.5 : 0 }} />
            <div className="absolute inset-y-0 right-0 w-1 bg-red-500 opacity-0 transition-opacity" 
                 style={{ opacity: isSwiping ? 0.5 : 0 }} />
          </div>
        );
      })}
    </div>
  );
} 