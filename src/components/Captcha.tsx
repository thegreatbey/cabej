import React, { useState, useEffect } from 'react'

// Word list for CAPTCHA challenges
const WORD_LIST = [
  'cat', 'dog', 'cell', 'book', 'tree', 'home', 'bird', 'fish', 
  'desk', 'mRNA', 'methylation', 'DNA', 'protein', 'gene', 'organism',
  'acetylation', 'histone', 'chromatin', 'mitosis', 'cytokinesis',
  'lamp', 'door', 'road', 'city', 'star', 'moon', 'ship', 'time',
  'hand', 'foot', 'head', 'card', 'game', 'ball', 'fire', 'blue',
  'rain', 'snow', 'wind', 'food', 'milk', 'rice', 'cake', 'song'
]

interface CaptchaProps {
  onSuccess: () => void
}

export default function Captcha({ onSuccess }: CaptchaProps) {
  const [word, setWord] = useState('')
  const [hiddenIndex, setHiddenIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [isError, setIsError] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [attempts, setAttempts] = useState(0)

  // Generate a new CAPTCHA challenge
  const generateChallenge = () => {
    // Select random word from the list
    const randomWord = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)]
    
    // Select random position to hide a letter (avoid first and last position for easier challenges)
    const randomIndex = Math.floor(Math.random() * (randomWord.length - 2)) + 1
    
    console.log(`New challenge: ${randomWord} with hidden letter at index ${randomIndex}: ${randomWord[randomIndex]}`)
    
    setWord(randomWord)
    setHiddenIndex(randomIndex)
    setUserInput('')
    setIsError(false)
  }

  // Initialize CAPTCHA on component mount
  useEffect(() => {
    generateChallenge()
  }, [])

  // Trigger onSuccess after showing success state for a moment
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        console.log('Calling onSuccess from useEffect after success state')
        onSuccess()
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [isSuccess, onSuccess])

  // Create the displayed challenge text with hidden letter
  const challengeText = word 
    ? `${word.substring(0, hiddenIndex)}_${word.substring(hiddenIndex + 1)}`
    : ''

  // Handle form submission - now just a regular function that's called on button click
  const handleSubmit = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    
    // Get the correct letter and user input
    const correctLetter = word[hiddenIndex] || ''
    const submittedLetter = userInput || ''
    
    console.log(`Submitted: "${submittedLetter}" (${typeof submittedLetter})`)
    console.log(`Correct: "${correctLetter}" (${typeof correctLetter})`)
    console.log(`Are they equal? ${submittedLetter.toLowerCase() === correctLetter.toLowerCase()}`)
    
    // Check if user entered the correct letter (case insensitive)
    if (submittedLetter.toLowerCase() === correctLetter.toLowerCase()) {
      console.log('✅ CAPTCHA successful!')
      setIsSuccess(true)
      // Don't call onSuccess here, let the useEffect do it
    } else {
      console.log('❌ CAPTCHA failed, generating new challenge')
      setIsError(true)
      setAttempts(attempts + 1)
      setUserInput('')
      setTimeout(() => {
        generateChallenge()
      }, 1500)
    }
  }

  // Handle key press to allow submission with enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userInput) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only take the first character if user pastes multiple
    setUserInput(e.target.value.charAt(0))
  }

  if (isSuccess) {
    return (
      <div className="w-full">
        <div className="bg-green-100 p-4 rounded-lg shadow-md text-center">
          <h3 className="text-lg font-medium mb-3 text-green-800">Verification Successful!</h3>
          <p className="text-green-700">Loading the generate button...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
        <h3 className="text-center text-base sm:text-lg font-medium mb-4">Human Verification</h3>
        
        <div className="text-center mb-6">
          <p className="text-sm sm:text-base mb-2">Type the missing letter:</p>
          <span className="inline-block font-mono text-xl sm:text-2xl bg-gray-50 px-4 py-2 rounded">
            {challengeText}
          </span>
        </div>
        
        <div className="flex flex-col items-center">
          <input
            type="text"
            value={userInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            maxLength={1}
            className={`w-16 h-16 text-center text-2xl border ${
              isError ? 'border-red-500' : 'border-gray-300'
            } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 touch-manipulation bg-white text-gray-900`}
            placeholder="_"
            autoFocus
            aria-label="Enter the missing letter"
            style={{ fontSize: '24px' }}
          />
          
          {isError && (
            <p className="text-red-500 text-sm sm:text-base mb-4">
              Incorrect letter. Please try again.
            </p>
          )}
          
          <button
            onClick={handleSubmit}
            className={`w-full sm:w-auto min-w-[120px] py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              userInput
                ? 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!userInput}
          >
            Verify
          </button>
        </div>
      </div>
    </div>
  )
} 