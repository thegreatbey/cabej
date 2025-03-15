import { useState, useEffect } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  console.log(`Initializing useLocalStorage for key: ${key}`)
  
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key)
      
      // Log for debugging
      console.log(`Reading localStorage key ${key}: ${item}`)
      
      // Parse stored json or if none return initialValue
      const parsedValue = item ? JSON.parse(item) : initialValue
      console.log(`Parsed value for ${key}:`, parsedValue)
      
      return parsedValue
    } catch (error) {
      console.error(`Error reading from localStorage key ${key}:`, error)
      return initialValue
    }
  })
  
  // Sync state to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        console.log(`Syncing localStorage key ${key} with value:`, storedValue)
        window.localStorage.setItem(key, JSON.stringify(storedValue))
      }
    } catch (error) {
      console.error(`Error syncing localStorage key ${key}:`, error)
    }
  }, [key, storedValue])
  
  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value
      
      console.log(`Setting localStorage key ${key} to:`, valueToStore)
      
      // Save state
      setStoredValue(valueToStore)
      
      // This is redundant with the useEffect above, but let's be extra sure
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error)
    }
  }
  
  // Force update from localStorage
  const syncFromStorage = () => {
    if (typeof window === 'undefined') {
      return
    }
    
    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        const parsedValue = JSON.parse(item)
        console.log(`Force syncing from localStorage key ${key}:`, parsedValue)
        setStoredValue(parsedValue)
      }
    } catch (error) {
      console.error(`Error in force sync for localStorage key ${key}:`, error)
    }
  }
  
  // Listen for changes to this local storage key in other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        console.log(`Storage event for key ${key}, new value:`, e.newValue)
        setStoredValue(JSON.parse(e.newValue))
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [key])
  
  // Return value, setter, and sync function
  return [storedValue, setValue, syncFromStorage] as const
} 