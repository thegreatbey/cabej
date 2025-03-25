import { useEffect, useRef, useState } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface TouchPosition {
  x: number;
  y: number;
}

export function useSwipe({ onSwipeLeft, onSwipeRight }: SwipeHandlers) {
  const touchStart = useRef<TouchPosition | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  
  // Constants for swipe detection
  const SWIPE_THRESHOLD = 50; // Minimum distance for a swipe
  const SWIPE_ANGLE_THRESHOLD = 30; // Maximum angle deviation for horizontal swipe

  const handleTouchStart = (e: TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    setIsSwiping(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!touchStart.current) return;

    const touchEnd = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };

    // Calculate distance and angle
    const deltaX = touchEnd.x - touchStart.current.x;
    const deltaY = touchEnd.y - touchStart.current.y;
    const angle = Math.abs(Math.atan2(deltaY, deltaX) * 180 / Math.PI);

    // Check if the swipe is horizontal enough
    if (angle < SWIPE_ANGLE_THRESHOLD || angle > (180 - SWIPE_ANGLE_THRESHOLD)) {
      e.preventDefault(); // Prevent scrolling while swiping horizontally
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchStart.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    // Calculate distance and angle
    const deltaX = touchEnd.x - touchStart.current.x;
    const deltaY = touchEnd.y - touchStart.current.y;
    const angle = Math.abs(Math.atan2(deltaY, deltaX) * 180 / Math.PI);

    // Check if the swipe is horizontal enough and meets the distance threshold
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && 
        (angle < SWIPE_ANGLE_THRESHOLD || angle > (180 - SWIPE_ANGLE_THRESHOLD))) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    touchStart.current = null;
    setIsSwiping(false);
  };

  useEffect(() => {
    const element = document;

    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight]);

  return { isSwiping };
} 