import React from 'react'
import { Conversation } from '../services/conversations'
import { Timestamp } from 'firebase/firestore'

interface ConversationListProps {
  conversations: Conversation[]
  onDelete: (id?: string) => void
  onSelect: (id: string) => void
  activeConversationId: string | null
}

export default function ConversationList({ 
  conversations, 
  onDelete,
  onSelect,
  activeConversationId
}: ConversationListProps) {
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
    <div className="space-y-4">
      {conversations.map((conv, index) => (
        <div 
          key={conv.id || index} 
          className={`p-3 border rounded relative transition-colors cursor-pointer ${
            conv.id === activeConversationId 
              ? 'border-blue-500 bg-blue-50' 
              : 'hover:bg-gray-50'
          }`}
          onClick={() => conv.id && onSelect(conv.id)}
        >
          <button 
            onClick={(e) => {
              e.stopPropagation() // Prevent triggering the parent div's onClick
              onDelete(conv.id)
            }}
            className="absolute top-2 right-2 text-red-500 hover:text-red-700 z-10"
            title="Delete conversation"
          >
            ✕
          </button>
          
          <div className="mb-3">
            <p className="font-medium text-gray-700">You:</p>
            <p className="text-gray-800">{conv.input}</p>
          </div>
          
          <div>
            <p className="font-medium text-gray-700">AI:</p>
            <p className="text-gray-800">{conv.response}</p>
          </div>
          
          {conv.createdAt && (
            <p className="text-xs text-gray-500 mt-2">
              {formatTimestamp(conv.createdAt)}
            </p>
          )}
        </div>
      ))}
    </div>
  )
} 