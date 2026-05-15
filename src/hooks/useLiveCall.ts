import { useState, useRef, useCallback, useEffect } from 'react'

interface UseLiveCallOptions {
  onTranscript: (text: string) => void
  onSpeakingStart: () => void
  onSpeakingEnd: () => void
}

export function useLiveCall({ onTranscript, onSpeakingStart, onSpeakingEnd }: UseLiveCallOptions) {
  const [isCallActive, setIsCallActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const isListeningRef = useRef(false)
  const silenceTimeoutRef = useRef<any>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'Q7IOSFX7VG3cnK4eU8Z4'

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition not supported')
      return
    }

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onstart = () => {
      isListeningRef.current = true
      setIsListening(true)
      setError(null)
    }

    rec.onresult = (event: any) => {
      let final = ''
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += t
        } else {
          interim += t
        }
      }

      if (final) {
        setTranscript(final)
        onTranscript(final)
      } else {
        setTranscript(interim)
      }

      // Reset silence timer on speech
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
      silenceTimeoutRef.current = setTimeout(() => {
        // Auto-stop listening after 2s silence
        if (isListeningRef.current) {
          rec.stop()
        }
      }, 2000)
    }

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setError('Microphone permission denied')
      } else if (e.error === 'no-speech') {
        // Auto-restart
        if (isListeningRef.current) {
          setTimeout(() => rec.start(), 500)
        }
      }
    }

    rec.onend = () => {
      if (isListeningRef.current && isCallActive) {
        // Restart listening for next turn
        setTimeout(() => {
          try { rec.start() } catch {}
        }, 300)
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = rec
  }, [onTranscript, isCallActive])

  // Start live call
  const startCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      // Initialize audio context for processing
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()

      setIsCallActive(true)
      isListeningRef.current = true

      // Start listening
      setTimeout(() => {
        try { recognitionRef.current?.start() } catch {}
      }, 500)

    } catch {
      setError('Microphone access denied')
    }
  }, [])

  // End call
  const endCall = useCallback(() => {
    isListeningRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsSpeaking(false)

    try { recognitionRef.current?.stop() } catch {}

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
    }

    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    audioContextRef.current?.close()

    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    speechSynthesis.cancel()
  }, [])

  // Speak response (interruptible)
  const speak = useCallback(async (text: string) => {
    if (!isCallActive) return

    setIsSpeaking(true)
    onSpeakingStart()

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      })

      if (res.ok && res.headers.get('content-type')?.includes('audio')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        currentAudioRef.current = audio

        audio.onended = () => {
          setIsSpeaking(false)
          onSpeakingEnd()
          URL.revokeObjectURL(url)
          // Auto-restart listening after speaking
          if (isCallActive) {
            setTimeout(() => {
              try { recognitionRef.current?.start() } catch {}
            }, 300)
          }
        }

        audio.onerror = () => {
          setIsSpeaking(false)
          onSpeakingEnd()
        }

        await audio.play()
        return
      }
      throw new Error('TTS failed')
    } catch {
      // Fallback
      const utter = new SpeechSynthesisUtterance(text)
      utter.onend = () => {
        setIsSpeaking(false)
        onSpeakingEnd()
        if (isCallActive) {
          setTimeout(() => {
            try { recognitionRef.current?.start() } catch {}
          }, 300)
        }
      }
      speechSynthesis.speak(utter)
    }
  }, [onSpeakingStart, onSpeakingEnd, voiceId, isCallActive])

  // Interrupt speaking
  const interrupt = useCallback(() => {
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    speechSynthesis.cancel()
    setIsSpeaking(false)
    onSpeakingEnd()

    // Immediately start listening
    setTimeout(() => {
      try { recognitionRef.current?.start() } catch {}
    }, 100)
  }, [onSpeakingEnd])

  return {
    isCallActive,
    isListening,
    isSpeaking,
    transcript,
    error,
    startCall,
    endCall,
    speak,
    interrupt,
  }
}
