import { useState, useEffect, useRef } from 'react';

export function useStreamingText(fullText: string, speed: number = 25) {
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayedText('');
    indexRef.current = 0;
    setIsStreaming(true);

    const interval = setInterval(() => {
      if (indexRef.current < fullText.length) {
        // Add characters in small chunks for natural feel
        const chunkSize = Math.floor(Math.random() * 3) + 1;
        const nextIndex = Math.min(indexRef.current + chunkSize, fullText.length);
        setDisplayedText(fullText.slice(0, nextIndex));
        indexRef.current = nextIndex;
      } else {
        setIsStreaming(false);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [fullText, speed]);

  return { displayedText, isStreaming };
}
