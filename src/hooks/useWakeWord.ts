import { useEffect, useRef, useCallback } from 'react'

interface UseWakeWordOptions {
  wakeWord: string
  onWake: () => void
  enabled: boolean
}

export function useWakeWord({ wakeWord, onWake, enabled }: UseWakeWordOptions) {
  const recognitionRef = useRef<any>(null)
  const isListeningRef = useRef(false)
  const wakeWordLower = wakeWord.toLowerCase()

  const startListening = useCallback(() => {
    if (!enabled || isListeningRef.current) return
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase()
        if (transcript.includes(wakeWordLower)) {
          onWake()
          // Restart to keep listening
          try { rec.stop() } catch {}
          return
        }
      }
    }

    rec.onend = () => {
      if (enabled) {
        setTimeout(() => {
          try { rec.start() } catch {}
        }, 500)
      }
      isListeningRef.current = false
    }

    rec.onerror = () => {
      isListeningRef.current = false
      if (enabled) {
        setTimeout(() => startListening(), 1000)
      }
    }

    try {
      rec.start()
      isListeningRef.current = true
      recognitionRef.current = rec
    } catch {}
  }, [enabled, wakeWordLower, onWake])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    try {
      recognitionRef.current?.stop()
    } catch {}
  }, [])

  useEffect(() => {
    if (enabled) {
      startListening()
    } else {
      stopListening()
    }
    return () => stopListening()
  }, [enabled, startListening, stopListening])

  return { isListening: isListeningRef.current }
}
